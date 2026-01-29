"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/libs/supabase/client";
import { useTransactions } from "@/lib/hooks/useTransactions";
import propfirmsData from "@/data/propfirms.json";
import PropProofLayout from "@/components/PropProofLayout";
import UserProfileCard from "@/components/UserProfileCard";
import ActiveLinksCard from "@/components/ActiveLinksCard";
import MetricsCards from "@/components/MetricsCards";
import MonthlyPayoutChart from "@/components/MonthlyPayoutChart";
import AccountSettingsModal from "@/components/AccountSettingsModal";
import ConnectWalletModal from "@/components/ConnectWalletModal";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isConnectWalletModalOpen, setIsConnectWalletModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backfillStatus, setBackfillStatus] = useState(null);

  // Get wallet address from profile
  const walletAddress = profile?.wallet_address;
  const hasNoWallet = profile !== null && !profile?.wallet_address?.trim();
  const { data: transactionData, loading: transactionsLoading } = useTransactions(walletAddress);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const supabase = createClient();
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        if (!currentUser) {
          window.location.href = "/signin";
          return;
        }

        setUser(currentUser);

        // Load profile
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", currentUser.id)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("Error loading profile:", error);
        }

        setProfile(profileData || null);

        // Check backfill status if wallet exists
        if (profileData?.wallet_address) {
          checkBackfillStatus();
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, []);

  // Check if backfill is in progress
  const checkBackfillStatus = async () => {
    try {
      const response = await fetch('/api/backfill-trader');
      if (response.ok) {
        const data = await response.json();
        setBackfillStatus(data);

        // If not backfilled yet and has wallet, poll for updates
        if (!data.backfilled && data.has_wallet) {
          // Poll every 10 seconds for status updates
          const pollInterval = setInterval(async () => {
            const statusResponse = await fetch('/api/backfill-trader');
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              setBackfillStatus(statusData);

              // Stop polling once backfilled
              if (statusData.backfilled) {
                clearInterval(pollInterval);
                // Reload transaction data
                window.location.reload();
              }
            }
          }, 10000); // Poll every 10 seconds

          // Cleanup on unmount
          return () => clearInterval(pollInterval);
        }
      }
    } catch (error) {
      console.error('Error checking backfill status:', error);
    }
  };

  // Calculate verified firms with aggregated payouts (sorted high to low)
  const verifiedFirms = useMemo(() => {
    if (!transactionData?.transactions || transactionData.transactions.length === 0) {
      return [];
    }

    const logoExtensions = {
      fundednext: "jpeg",
      fundingpips: "webp",
      the5ers: "webp",
    };

    const firmsWithPayouts = propfirmsData.firms.map((firm) => {
      const firmAddressesLower = new Set(
        firm.addresses.map((addr) => addr.toLowerCase())
      );
      const firmTxs = transactionData.transactions.filter((tx) =>
        firmAddressesLower.has((tx.from || "").toLowerCase())
      );
      const totalPayout = firmTxs.reduce((sum, tx) => sum + (tx.amountUSD || 0), 0);
      const extension = logoExtensions[firm.id] || "png";
      const logoPath = `/logos/firms/${firm.id}.${extension}`;
      return {
        ...firm,
        logoPath,
        totalPayout,
      };
    });

    return firmsWithPayouts
      .filter((f) => f.totalPayout > 0)
      .sort((a, b) => b.totalPayout - a.totalPayout);
  }, [transactionData?.transactions]);

  // Calculate success rate (simplified - based on payout count)
  const payoutCount = transactionData?.transactions?.length || 0;
  const successRate = payoutCount > 0 ? Math.min(84.2, 50 + (payoutCount * 2)) : 0;

  // Format member since date
  const memberSince = profile?.created_at 
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : user?.created_at 
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  // Get display name
  const displayName = profile?.display_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
  const handle = profile?.handle || user?.email?.split("@")[0]?.toLowerCase() || null;
  const bio = profile?.bio || null;
  const avatarUrl = user?.user_metadata?.avatar_url || null;

  // Social links
  const socialLinks = {
    twitter: profile?.twitter || null,
    youtube: profile?.youtube || null,
  };

  // Calculate trust rating (simplified)
  const trustRating = Math.min(100, Math.max(70, 70 + (payoutCount * 2)));

  const handleProfileUpdate = (updatedProfile, backfillTriggered) => {
    setProfile(updatedProfile);

    // If backfill was triggered, update status to show syncing banner
    if (backfillTriggered) {
      setBackfillStatus({
        backfilled: false,
        has_wallet: true,
        backfilled_at: null
      });

      // Start polling for completion
      checkBackfillStatus();
    } else {
      // Just reload to refresh data
      window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-200/60 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-gray-300 border-r-transparent"></div>
          <p className="mt-4 text-sm text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <PropProofLayout>
      {/* Dashboard Header - Connected to nav with white background, full width */}
      <div className="bg-white border-b border-slate-200 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">My Dashboard</h1>
              {profile?.created_at && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#635BFF' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Your profile is verified and active since {memberSince}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Edit Settings
              </button>
              {hasNoWallet ? (
                <button
                  onClick={() => setIsConnectWalletModalOpen(true)}
                  className="px-6 py-2 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                  style={{ backgroundColor: '#635BFF' }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#5a52e6'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#635BFF'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a2.25 2.25 0 01-2.25-2.25V6a2.25 2.25 0 012.25-2.25h2.25A2.25 2.25 0 0121 6v2.25a2.25 2.25 0 01-2.25 2.25H21m0-2.25v2.25m0-9V15m2.25 2.25 0 001.5 0V15m2.25-2.25h-9m-9 0H3m2.25 2.25H3m9 0h9M3 15v2.25M21 15V15" />
                  </svg>
                  Connect Wallet
                </button>
              ) : (
                <button
                  onClick={() => setIsConnectWalletModalOpen(true)}
                  className="px-6 py-2 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                  style={{ backgroundColor: '#635BFF' }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#5a52e6'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#635BFF'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a2.25 2.25 0 01-2.25-2.25V6a2.25 2.25 0 012.25-2.25h2.25A2.25 2.25 0 0121 6v2.25a2.25 2.25 0 01-2.25 2.25H21m0-2.25v2.25m0-9V15m2.25 2.25 0 001.5 0V15m2.25-2.25h-9m-9 0H3m2.25 2.25H3m9 0h9M3 15v2.25M21 15V15" />
                  </svg>
                  Edit Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-8">

        {/* Syncing Banner */}
        {backfillStatus && backfillStatus.has_wallet && !backfillStatus.backfilled && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-blue-900 mb-1">
                  Syncing Your Transaction History
                </h3>
                <p className="text-xs text-blue-700">
                  We're loading your complete payout history from the blockchain. This usually takes 1-5 minutes depending on your transaction volume. Your dashboard will automatically update once complete.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Profile & Active Links */}
          <div className="lg:col-span-4 space-y-6">
            <UserProfileCard
              displayName={displayName}
              handle={handle}
              avatarUrl={avatarUrl}
              bio={bio}
              socialLinks={socialLinks}
              payoutCount={payoutCount}
              memberSince={memberSince}
              trustScore={trustRating}
            />

            <ActiveLinksCard
              verifiedFirms={verifiedFirms}
              loading={transactionsLoading}
            />
          </div>

          {/* Right Column: Metrics & Charts */}
          <div className="lg:col-span-8 space-y-8">
            <MetricsCards
              totalVerified={transactionData?.totalPayoutUSD || 0}
              last30Days={transactionData?.last30DaysPayoutUSD || 0}
              avgPayout={transactionData?.avgPayoutUSD || 0}
              loading={transactionsLoading}
            />

            <MonthlyPayoutChart
              transactions={transactionData?.transactions || []}
              loading={transactionsLoading}
              hasNoWallet={hasNoWallet}
              onConnectWallet={hasNoWallet ? () => setIsConnectWalletModalOpen(true) : undefined}
            />

            {/* Verified Transactions Table */}
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
                    {transactionsLoading ? (
                      // Loading state
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-6 py-4" colSpan={5}>
                            <div className="h-4 bg-gray-100 rounded animate-pulse"></div>
                          </td>
                        </tr>
                      ))
                    ) : !transactionData?.transactions || transactionData.transactions.length === 0 ? (
                      // Empty state: Connect Wallet CTA when no wallet, else fallback text
                      <tr>
                        <td className="px-6 py-8 text-center" colSpan={5}>
                          {hasNoWallet ? (
                            <div className="flex flex-col items-center gap-4">
                              <p className="text-sm text-gray-500">Connect your wallet to see verified transactions</p>
                              <button
                                type="button"
                                onClick={() => setIsConnectWalletModalOpen(true)}
                                className="px-6 py-2.5 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                                style={{ backgroundColor: '#635BFF' }}
                                onMouseEnter={(e) => { e.target.style.backgroundColor = '#5a52e6'; }}
                                onMouseLeave={(e) => { e.target.style.backgroundColor = '#635BFF'; }}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a2.25 2.25 0 01-2.25-2.25V6a2.25 2.25 0 012.25-2.25h2.25A2.25 2.25 0 0121 6v2.25a2.25 2.25 0 01-2.25 2.25H21m0-2.25v2.25m0-9V15m2.25 2.25 0 001.5 0V15m2.25-2.25h-9m-9 0H3m2.25 2.25H3m9 0h9M3 15v2.25M21 15V15" />
                                </svg>
                                Connect Wallet
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">No transactions found</span>
                          )}
                        </td>
                      </tr>
                    ) : (
                      // Data rows - limit to 10 latest payouts
                      transactionData.transactions.slice(0, 10).map((tx) => (
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
              {!transactionsLoading && transactionData?.transactions && transactionData.transactions.length > 0 && (
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

      {/* Settings Modal */}
      <AccountSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onUpdate={handleProfileUpdate}
      />

      {/* Connect Wallet Modal (for users without a wallet) */}
      <ConnectWalletModal
        isOpen={isConnectWalletModalOpen}
        onClose={() => setIsConnectWalletModalOpen(false)}
        onUpdate={handleProfileUpdate}
      />
    </PropProofLayout>
  );
}
