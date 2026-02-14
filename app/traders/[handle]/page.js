"use client";

import { use, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import PropProofLayout from "@/components/common/PropProofLayout";
import { useTransactions } from "@/lib/hooks/useTransactions";
import propfirmsData from "@/data/propfirms.json";
import UserProfileCard from "@/components/common/UserProfileCard";
import ActiveLinksCard from "@/components/common/ActiveLinksCard";
import MetricsCards from "@/components/common/MetricsCards";
import MonthlyPayoutChart from "@/components/common/MonthlyPayoutChart";

const ProfilePage = ({ params }) => {
  const { handle } = use(params);
  const [trader, setTrader] = useState(null);
  const [traderLoading, setTraderLoading] = useState(true);
  const [traderError, setTraderError] = useState(null);
  
  // Fetch trader data from API
  useEffect(() => {
    const fetchTrader = async () => {
      try {
        setTraderLoading(true);
        setTraderError(null);
        const response = await fetch(`/api/trader/${handle}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setTraderError("not_found");
          } else {
            setTraderError("Failed to fetch trader");
          }
          setTrader(null);
          return;
        }

        const data = await response.json();
        setTrader(data.trader);
      } catch (error) {
        console.error("Error fetching trader:", error);
        setTraderError("Failed to fetch trader");
        setTrader(null);
      } finally {
        setTraderLoading(false);
      }
    };

    if (handle) {
      fetchTrader();
    }
  }, [handle]);

  // Use trader's wallet address for transactions
  // Must call hooks before any conditional returns
  const walletAddress = trader?.walletAddress || null;
  const { data, loading, error } = useTransactions(walletAddress);

  // Match transactions to verified firms
  // Must call useMemo before conditional returns to follow Rules of Hooks
  const verifiedFirms = useMemo(() => {
    if (!data?.transactions || data.transactions.length === 0) {
      return [];
    }

    // Get unique sender addresses from transactions
    const senderAddresses = new Set(
      data.transactions.map(tx => tx.from.toLowerCase())
    );

    // Find firms that match transaction sender addresses
    const matchedFirms = propfirmsData.firms.filter(firm => {
      return firm.addresses.some(addr => 
        senderAddresses.has(addr.toLowerCase())
      );
    });

    // Logo file extension mapping based on actual files
    const logoExtensions = {
      'fundednext': 'jpeg',
      'fundingpips': 'webp',
      'the5ers': 'webp',
      // All others use .png
    };

    // Map to include logo path
    return matchedFirms.map(firm => {
      const extension = logoExtensions[firm.id] || 'png';
      const logoPath = `/logos/firms/${firm.id}.${extension}`;

      return {
        ...firm,
        logoPath,
      };
    });
  }, [data?.transactions]);

  // Loading state
  if (traderLoading) {
    return (
      <div className="min-h-screen bg-slate-200/60 flex items-center justify-center p-4 text-center">
        <div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading trader profile...</p>
        </div>
      </div>
    );
  }

  // Error or not found state
  if (traderError || !trader) {
    return (
      <div className="min-h-screen bg-slate-200/60 flex items-center justify-center p-4 text-center">
        <div>
          <h1 className="text-4xl font-bold mb-4">Trader Not Found</h1>
          <p className="text-gray-500 mb-8">This handle does not exist on PropProof.</p>
          <Link href="/traders" className="bg-black text-white px-6 py-3 rounded-xl font-bold">
            Back to Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PropProofLayout>
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-8">
      <Link
        href="/traders"
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
        Back to traders
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Col: Profile Intro */}
        <div className="lg:col-span-4 space-y-6">
          <UserProfileCard
            displayName={trader.displayName}
            handle={trader.handle}
            avatarUrl={`https://ui-avatars.com/api/?name=${encodeURIComponent(trader.displayName)}&background=635BFF&color=fff&size=128&bold=true`}
            bio={trader.bio}
            socialLinks={trader.socialLinks}
            payoutCount={trader.payoutCount}
            memberSince={trader.createdAt ? new Date(trader.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : "N/A"}
            trustScore={98}
          />

          <ActiveLinksCard
            verifiedFirms={verifiedFirms}
            loading={loading}
          />
        </div>

        {/* Right Col: Stats and Charts */}
        <div className="lg:col-span-8 space-y-8">
          <MetricsCards
            totalVerified={data?.totalPayoutUSD || 0}
            last30Days={data?.last30DaysPayoutUSD || 0}
            avgPayout={data?.avgPayoutUSD || 0}
            loading={loading}
          />

          <MonthlyPayoutChart
            transactions={data?.transactions || []}
            loading={loading}
          />

          {/* Recent Payout Log */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Verified Transactions</h3>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mt-1">Historical Blockchain Records</p>
                </div>
                <div className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5" style={{ backgroundColor: 'rgba(99, 91, 255, 0.1)', color: '#635BFF' }}>
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
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#635BFF' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {tx.token}
                        </td>
                        <td className="px-6 py-4">
                          <a
                            href={tx.arbiscanUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] px-2.5 py-1 rounded-md border transition-colors inline-flex items-center gap-1 font-semibold"
                            style={{ backgroundColor: 'rgba(99, 91, 255, 0.1)', color: '#635BFF', borderColor: 'rgba(99, 91, 255, 0.2)' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 91, 255, 0.2)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 91, 255, 0.1)'}
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
