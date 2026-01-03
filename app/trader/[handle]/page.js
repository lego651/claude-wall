"use client";

import Link from "next/link";
import Image from "next/image";
import PropProofLayout from "@/components/PropProofLayout";
import { MOCK_TRADERS, FIRMS } from "@/lib/constants";
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

const ProfilePage = ({ params }) => {
  const { handle } = params;
  const trader = MOCK_TRADERS.find((t) => t.handle === handle);

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

  // Mock chart data
  const chartData = [
    { month: "Jan", amount: 4500 },
    { month: "Feb", amount: 5200 },
    { month: "Mar", amount: 0 },
    { month: "Apr", amount: 12000 },
    { month: "May", amount: 8400 },
    { month: "Jun", amount: 15000 },
  ];

  return (
    <PropProofLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <Link
        href="/leaderboard"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black mb-8 group"
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Col: Profile Intro */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-6">
                <Image
                  src={trader.avatarUrl}
                  alt={trader.displayName}
                  width={128}
                  height={128}
                  className="w-32 h-32 rounded-3xl object-cover bg-gray-100 border-4 border-white shadow-xl"
                />
                <div className="absolute -bottom-2 -right-2 bg-blue-500 text-white p-1.5 rounded-full border-4 border-white shadow-lg">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>

              <h1 className="text-2xl font-bold mb-1">{trader.displayName}</h1>
              <p className="text-gray-500 font-medium mb-4">@{trader.handle}</p>

              {trader.bio && (
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">{trader.bio}</p>
              )}

              <div className="flex gap-4 mb-8">
                {trader.socialLinks.twitter && (
                  <a
                    href={trader.socialLinks.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-gray-50 rounded-lg hover:bg-black hover:text-white transition-all"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                    </svg>
                  </a>
                )}
                {trader.socialLinks.youtube && (
                  <a
                    href={trader.socialLinks.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-gray-50 rounded-lg hover:bg-black hover:text-white transition-all"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </a>
                )}
                <a
                  href="#"
                  className="p-2 bg-gray-50 rounded-lg hover:bg-black hover:text-white transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>

              <div className="w-full pt-8 border-t border-gray-100 space-y-4 text-left">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span>Member since</span>
                  </div>
                  <span className="font-semibold">Dec 2023</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                      />
                    </svg>
                    <span>Payout count</span>
                  </div>
                  <span className="font-semibold">{trader.payoutCount} verified</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 text-gray-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                    <span>Trust score</span>
                  </div>
                  <span className="font-bold text-green-600">98/100</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-black text-white p-6 rounded-2xl">
            <h3 className="text-sm font-bold uppercase tracking-widest text-blue-400 mb-4">
              Verified Firms
            </h3>
            <div className="space-y-3">
              {FIRMS.slice(0, 3).map((firm) => (
                <div
                  key={firm.id}
                  className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10"
                >
                  <Image
                    src={firm.logoUrl}
                    alt={firm.name}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-lg bg-gray-100 object-cover"
                  />
                  <span className="font-medium text-sm">{firm.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Stats and Charts */}
        <div className="lg:col-span-8 space-y-8">
          {/* Headline Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                Total Verified
              </p>
              <h2 className="text-3xl font-black">${trader.totalVerifiedPayout.toLocaleString()}</h2>
            </div>
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                Last 30 Days
              </p>
              <h2 className="text-3xl font-black text-green-600">
                ${trader.last30DaysPayout.toLocaleString()}
              </h2>
            </div>
            <div className="bg-white border border-gray-100 p-6 rounded-2xl shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                Avg. Payout
              </p>
              <h2 className="text-3xl font-black text-blue-600">
                $
                {(trader.totalVerifiedPayout / trader.payoutCount).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </h2>
            </div>
          </div>

          {/* Payout History Chart */}
          <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-bold">Monthly Payout History</h3>
                <p className="text-xs text-gray-400">Values represent confirmed on-chain inflows</p>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-gray-100 rounded-md text-xs font-bold">6M</button>
                <button className="px-3 py-1 text-xs font-bold text-gray-400">1Y</button>
                <button className="px-3 py-1 text-xs font-bold text-gray-400">ALL</button>
              </div>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fontWeight: 600, fill: "#9ca3af" }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fontWeight: 600, fill: "#9ca3af" }}
                    tickFormatter={(value) => `$${value / 1000}k`}
                  />
                  <Tooltip
                    cursor={{ fill: "#f9fafb" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.amount > 0 ? "#111827" : "#e5e7eb"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Payout Log */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold">Verified Transaction Log</h3>
              <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                Live Feed
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Firm
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      Tx Hash
                    </th>
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {trader.payouts.map((payout) => (
                    <tr key={payout.id}>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(payout.timestamp).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold">
                        {FIRMS.find((f) => f.id === payout.firmId)?.name || "Unknown Firm"}
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-[10px] bg-gray-50 px-2 py-1 rounded border border-gray-100 text-gray-400">
                          0x4a...f2e9
                        </code>
                      </td>
                      <td className="px-6 py-4 text-right font-black">
                        ${payout.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-gray-50/50 text-center">
              <button className="text-xs font-bold text-gray-400 hover:text-black transition-colors">
                Load older transactions
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </PropProofLayout>
  );
};

export default ProfilePage;
