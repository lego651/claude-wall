"use client";

import { use } from "react";
import Link from "next/link";
import Image from "next/image";
import PropProofLayout from "@/components/PropProofLayout";
import { MOCK_TRADERS, FIRMS } from "@/lib/constants";
import { useTransactions } from "@/lib/hooks/useTransactions";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const TEST_WALLET = process.env.NEXT_PUBLIC_TEST_WALLET_ADDRESS;

const ProfilePage = ({ params }) => {
  const { handle } = use(params);
  const trader = MOCK_TRADERS.find((t) => t.handle === handle);
  const { data, loading, error } = useTransactions(TEST_WALLET);

  if (!trader) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center">
        <div>
          <h1 className="text-4xl font-bold mb-4">Trader Not Found</h1>
          <p className="text-gray-500 mb-8">This handle does not exist on PropProof.</p>
          <Link href="/leaderboard" className="bg-black text-white px-6 py-3 rounded-xl font-bold">
            Back to Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  // Use real blockchain data for chart
  const chartData = data?.monthlyData || [];

  return (
    <PropProofLayout>
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-8">
      <Link
        href="/leaderboard"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-6 group font-medium"
      >
        <svg
          className="w-4 h-4 group-hover:-translate-x-1 transition-transform"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to leaderboard
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Col: Profile Intro */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-6">
                <Image
                  src={trader.avatarUrl}
                  alt={trader.displayName}
                  width={128}
                  height={128}
                  className="w-28 h-28 rounded-3xl object-cover bg-slate-100 shadow-lg"
                />
                <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-1 rounded-full border-3 border-white shadow-md">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>

              <h1 className="text-2xl font-bold text-slate-900 mb-1">{trader.displayName}</h1>
              <p className="text-indigo-600 font-semibold text-sm mb-6">@{trader.handle}</p>

              {trader.bio && (
                <p className="text-sm text-slate-600 mb-8 leading-relaxed">{trader.bio}</p>
              )}

              <div className="flex gap-3 mb-8">
                {trader.socialLinks.twitter && (
                  <a
                    href={trader.socialLinks.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 bg-slate-50 rounded-lg hover:bg-slate-900 hover:text-white transition-all"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                    </svg>
                  </a>
                )}
                {trader.socialLinks.youtube && (
                  <a
                    href={trader.socialLinks.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 bg-slate-50 rounded-lg hover:bg-slate-900 hover:text-white transition-all"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </a>
                )}
                <a
                  href="#"
                  className="p-2.5 bg-slate-50 rounded-lg hover:bg-slate-900 hover:text-white transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>

              <div className="w-full pt-6 border-t border-slate-100 space-y-5 text-left">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span>Member since</span>
                  </div>
                  <span className="font-bold text-slate-900">Dec 2023</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                      />
                    </svg>
                    <span>Payout count</span>
                  </div>
                  <span className="font-bold text-slate-900">{trader.payoutCount} verified</span>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2 text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                      <span>Trust score</span>
                    </div>
                    <span className="font-bold text-emerald-600">98/100</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: '98%' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Verified Firms
              </h3>
              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="space-y-3">
              {FIRMS.slice(0, 3).map((firm, index) => {
                const colors = ['bg-slate-900', 'bg-cyan-500', 'bg-orange-500'];
                return (
                  <a
                    key={firm.id}
                    href={`/propfirm/${firm.id}`}
                    className="flex items-center justify-between p-3 bg-slate-50/50 hover:bg-slate-100/50 rounded-xl border border-slate-200 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${colors[index]} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                        {firm.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-semibold text-sm text-slate-900">{firm.name}</span>
                    </div>
                    <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Stats and Charts */}
        <div className="lg:col-span-8 space-y-8">
          {/* Headline Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  Total Verified
                </p>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <svg className="w-4 h-4 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                {loading ? (
                  <span className="text-slate-300">Loading...</span>
                ) : error ? (
                  <span className="text-red-500 text-sm">Error</span>
                ) : (
                  `$${data?.totalPayoutUSD?.toLocaleString() || '0'}`
                )}
              </h2>
            </div>
            <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  Last 30 Days
                </p>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-emerald-600 tracking-tight">
                {loading ? (
                  <span className="text-slate-300">Loading...</span>
                ) : error ? (
                  <span className="text-red-500 text-sm">Error</span>
                ) : (
                  `$${data?.last30DaysPayoutUSD?.toLocaleString() || '0'}`
                )}
              </h2>
            </div>
            <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  Avg. Payout
                </p>
                <div className="p-2 bg-slate-50 rounded-lg">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-blue-600 tracking-tight">
                {loading ? (
                  <span className="text-slate-300">Loading...</span>
                ) : error ? (
                  <span className="text-red-500 text-sm">Error</span>
                ) : (
                  `$${data?.avgPayoutUSD?.toLocaleString() || '0'}`
                )}
              </h2>
            </div>
          </div>

          {/* Payout History Chart */}
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Monthly Payout History</h3>
                <p className="text-sm text-slate-400 mt-1">On-chain verified inflows per month</p>
              </div>
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                <button className="px-4 py-2 bg-slate-900 text-white shadow-sm rounded-lg text-xs font-bold">6M</button>
                <button className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700">1Y</button>
                <button className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700">ALL</button>
              </div>
            </div>

            <div className="h-[300px] w-full">
              {loading ? (
                // Loading state
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gray-300 border-r-transparent"></div>
                    <p className="mt-4 text-sm text-gray-400">Loading chart data...</p>
                  </div>
                </div>
              ) : error ? (
                // Error state
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-red-500">Error loading chart data</p>
                </div>
              ) : chartData.length === 0 ? (
                // Empty state
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-gray-400">No chart data available</p>
                </div>
              ) : (
                // Chart with real data
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#94a3b8", fontWeight: 500 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#94a3b8", fontWeight: 500 }}
                      tickFormatter={(value) => `$${value / 1000}k`}
                    />
                    <Tooltip
                      cursor={{ fill: "#f1f5f9" }}
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '0.75rem',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value) => [`$${value.toLocaleString()}`, 'Amount']}
                    />
                    <Bar dataKey="amount" radius={[12, 12, 12, 12]} maxBarSize={60}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.amount > 0 ? "#0f172a" : "#e5e7eb"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Recent Payout Log */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Verified Transactions</h3>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">Historical Blockchain Records</p>
                </div>
                <div className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Real-time Feed
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      Date
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      From
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      Token
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      Tx Hash
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    // Loading state
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4" colSpan={5}>
                          <div className="h-4 bg-gray-100 rounded animate-pulse"></div>
                        </td>
                      </tr>
                    ))
                  ) : error ? (
                    // Error state
                    <tr>
                      <td className="px-6 py-8 text-center text-sm text-red-500" colSpan={5}>
                        Error loading transactions: {error}
                      </td>
                    </tr>
                  ) : !data?.transactions || data.transactions.length === 0 ? (
                    // Empty state
                    <tr>
                      <td className="px-6 py-8 text-center text-sm text-gray-400" colSpan={5}>
                        No transactions found
                      </td>
                    </tr>
                  ) : (
                    // Data rows - limit to 10 latest payouts
                    data.transactions.slice(0, 10).map((tx) => (
                      <tr key={tx.txHash} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                          {new Date(tx.timestamp * 1000).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <code className="text-[10px] bg-slate-50 px-2 py-1 rounded border border-slate-200 text-slate-500 font-medium">
                            {tx.fromShort}
                          </code>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900 flex items-center gap-2">
                          <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {tx.token}
                        </td>
                        <td className="px-6 py-4">
                          <a
                            href={tx.arbiscanUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-md border border-indigo-100 hover:bg-indigo-100 transition-colors inline-flex items-center gap-1 font-semibold"
                          >
                            {tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">
                          ${tx.amountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!loading && !error && data?.transactions && data.transactions.length > 0 && (
              <div className="p-5 bg-white text-center border-t border-slate-100">
                <button className="text-xs text-slate-400 font-semibold hover:text-slate-600 transition-colors uppercase tracking-wide flex items-center gap-2 mx-auto">
                  View All Activity
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </PropProofLayout>
  );
};

export default ProfilePage;
