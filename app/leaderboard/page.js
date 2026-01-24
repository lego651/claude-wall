"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import PropProofLayout from "@/components/PropProofLayout";

const LeaderboardPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [traders, setTraders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch traders from API (now includes cached stats)
  useEffect(() => {
    const fetchTraders = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/leaderboard");
        
        if (!response.ok) {
          console.error("Failed to fetch leaderboard");
          setTraders([]);
          return;
        }

        const data = await response.json();
        
        // API now returns traders with cached stats already included
        // Add avatar URLs
        const tradersWithAvatars = (data.traders || []).map((trader) => ({
          ...trader,
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(trader.displayName)}&background=635BFF&color=fff&size=128&bold=true`,
        }));
        
        setTraders(tradersWithAvatars);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
        setTraders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTraders();
  }, []);

  // Calculate aggregate stats for sidebar
  const aggregateStats = useMemo(() => {
    const totalVerified = traders.reduce(
      (sum, t) => sum + (t.totalVerifiedPayout || 0),
      0
    );
    const verifiedTraders = traders.filter(t => (t.totalVerifiedPayout || 0) > 0).length;
    
    return {
      totalVerifiedValue: totalVerified,
      verifiedTraders,
    };
  }, [traders]);

  const filteredTraders = traders
    .filter(
      (t) =>
        t.handle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.displayName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => b.totalVerifiedPayout - a.totalVerifiedPayout);

  return (
    <PropProofLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">The Verified Leaderboard</h1>
          <p className="text-gray-500 max-w-lg">
            A public registry of traders with automatically verified payouts from major prop firms.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors w-[18px] h-[18px]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search traders..."
              className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-black/5 focus:bg-white focus:border-black transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Table */}
        <div className="lg:col-span-3">
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Rank
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      Trader
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">
                      30d Change
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">
                      Total Verified
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    // Loading state
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-6 py-6" colSpan={5}>
                          <div className="h-4 bg-gray-100 rounded animate-pulse"></div>
                        </td>
                      </tr>
                    ))
                  ) : filteredTraders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center text-gray-400">
                        {searchTerm ? "No traders found matching your search." : "No traders found. Be the first to join the leaderboard!"}
                      </td>
                    </tr>
                  ) : (
                    filteredTraders.map((trader, idx) => (
                    <tr key={trader.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-6 py-6">
                        <span
                          className={`text-sm font-bold ${
                            idx < 3 ? "text-black" : "text-gray-300"
                          }`}
                        >
                          {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                        </span>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-3">
                          <img
                            src={trader.avatarUrl}
                            alt={trader.displayName}
                            className="w-10 h-10 rounded-xl bg-gray-100 object-cover"
                            onError={(e) => {
                              // Fallback to initials if image fails
                              e.target.style.display = 'none';
                              const fallback = e.target.nextElementSibling;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center hidden">
                            <span className="text-sm font-bold text-white">
                              {trader.displayName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-bold flex items-center gap-1 text-sm">
                              {trader.displayName}
                              {idx < 10 && (
                                <svg
                                  className="w-3 h-3 text-blue-500 fill-blue-500"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </div>
                            <div className="text-xs text-gray-400">@{trader.handle}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-right">
                        <div
                          className={`text-sm font-semibold flex items-center justify-end gap-1 ${
                            (trader.last30DaysPayout || 0) > 0 ? "text-green-600" : "text-gray-400"
                          }`}
                        >
                          {(trader.last30DaysPayout || 0) > 0 && (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                              />
                            </svg>
                          )}
                          ${(trader.last30DaysPayout || 0).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-6 text-right font-bold text-base">
                        ${(trader.totalVerifiedPayout || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex justify-center">
                          <Link
                            href={`/trader/${trader.handle}`}
                            className="p-2 rounded-lg bg-gray-50 text-gray-400 opacity-0 group-hover:opacity-100 group-hover:bg-black group-hover:text-white transition-all flex items-center gap-1 text-xs font-bold"
                          >
                            Profile
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 17L17 7m0 0H7m10 0v10"
                              />
                            </svg>
                          </Link>
                        </div>
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-black text-white p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-4 text-blue-400 font-bold text-sm uppercase tracking-wider">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              Trust Score Info
            </div>
            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
              PropProof verifies data directly from prop firm payout wallets. No screenshots or CSVs are allowed.
            </p>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs border-b border-white/10 pb-2">
                <span className="text-gray-400">Total Verified Value</span>
                <span className="font-bold">
                  {loading ? "..." : `$${(aggregateStats.totalVerifiedValue / 1000000).toFixed(1)}M`}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-white/10 pb-2">
                <span className="text-gray-400">Active Prop Firms</span>
                <span className="font-bold">24</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400">Verified Traders</span>
                <span className="font-bold">
                  {loading ? "..." : aggregateStats.verifiedTraders.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 border border-gray-100 rounded-2xl bg-gray-50/50">
            <h4 className="font-bold mb-3 text-sm">Recently Verified</h4>
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-4">
                  <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-gray-300 border-r-transparent"></div>
                </div>
              ) : traders.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-4">
                  No verified traders yet
                </div>
              ) : (
                traders
                  .filter(t => (t.totalVerifiedPayout || 0) > 0)
                  .slice(0, 3)
                  .map((trader) => (
                    <div key={trader.id} className="flex items-center gap-3">
                      <img
                        src={trader.avatarUrl}
                        alt={trader.displayName}
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => {
                          // Fallback to initials if image fails
                          e.target.style.display = 'none';
                          const fallback = e.target.nextElementSibling;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center hidden">
                        <span className="text-xs font-bold text-white">
                          {trader.displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-bold">{trader.displayName}</div>
                        <div className="text-[10px] text-gray-400">
                          ${((trader.totalVerifiedPayout || 0) / 1000).toFixed(1)}k verified
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </PropProofLayout>
  );
};

export default LeaderboardPage;
