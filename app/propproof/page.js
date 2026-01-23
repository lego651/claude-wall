import Link from "next/link";
import Image from "next/image";
import { getSEOTags } from "@/libs/seo";
import config from "@/config";
import PropProofLayout from "@/components/PropProofLayout";

export const metadata = getSEOTags({
  title: `PropProof - Stop faking screenshots. Prove real payouts. | ${config.appName}`,
  description: "The trust layer for prop trading. Verify on-chain and Rise payouts automatically with a shareable profile.",
  canonicalUrlRelative: "/propproof",
});

// Mock data for demonstration
const MOCK_TRADERS = [
  {
    id: 1,
    displayName: "The Funded Lady",
    handle: "thefundedlady",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=128&h=128&fit=crop",
    totalVerifiedPayout: 215000,
    last30DaysPayout: 22000,
  },
  {
    id: 2,
    displayName: "Crypto King",
    handle: "cryptoking",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=128&h=128&fit=crop",
    totalVerifiedPayout: 189000,
    last30DaysPayout: 18500,
  },
  {
    id: 3,
    displayName: "Trade Master",
    handle: "trademaster",
    avatarUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=128&h=128&fit=crop",
    totalVerifiedPayout: 167000,
    last30DaysPayout: 15200,
  },
];

const PropProofLanding = () => {
  const topTraders = [...MOCK_TRADERS].sort((a, b) => b.totalVerifiedPayout - a.totalVerifiedPayout).slice(0, 3);

  return (
    <PropProofLayout>
      <div className="relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50 blur-[120px] rounded-full opacity-60"></div>
        <div className="absolute bottom-0 right-[-10%] w-[40%] h-[40%] bg-indigo-50 blur-[120px] rounded-full opacity-60"></div>
      </div>

      {/* Hero Section */}
      <section className="pt-24 pb-16 md:pt-32 md:pb-32 px-4">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-black/5 text-black px-3 py-1 rounded-full text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Now live for on-chain payouts
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-gray-900 leading-[1.1] mb-8">
              Stop faking screenshots. <br />
              <span className="text-gray-400">Prove real payouts.</span>
            </h1>
            <p className="text-xl text-gray-600 mb-10 max-w-lg leading-relaxed">
              PropProof is the trust layer for prop trading. We verify on-chain and Rise payouts automatically, giving you a shareable profile that proves you&apos;re the real deal.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="#create"
                className="bg-black text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2 group shadow-xl shadow-black/10"
              >
                Create your profile
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                href="#leaderboard"
                className="bg-white text-gray-900 border border-gray-200 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-50 transition-all flex items-center justify-center"
              >
                View Leaderboard
              </Link>
            </div>
          </div>

          {/* Hero Image/Card Mock */}
          <div className="relative">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl p-8 max-w-md mx-auto relative z-10">
              <div className="flex items-center gap-4 mb-8">
                <Image
                  src={topTraders[0].avatarUrl}
                  alt={topTraders[0].displayName}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-2xl bg-gray-100 object-cover"
                />
                <div>
                  <h3 className="font-bold text-xl">{topTraders[0].displayName}</h3>
                  <p className="text-gray-500 font-medium">@{topTraders[0].handle}</p>
                </div>
                <div className="ml-auto bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Verified
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Total Payouts</p>
                  <p className="text-2xl font-bold">${topTraders[0].totalVerifiedPayout.toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Last 30 Days</p>
                  <p className="text-2xl font-bold">${topTraders[0].last30DaysPayout.toLocaleString()}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-black w-4/5"></div>
                </div>
                <div className="flex justify-between text-xs font-medium text-gray-500">
                  <span>Growth since join</span>
                  <span className="text-black">+240%</span>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-100 flex justify-between items-center">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] font-bold">
                      F{i}
                    </div>
                  ))}
                </div>
                <span className="text-xs font-medium text-gray-400 uppercase">Linked Firm Sources</span>
              </div>
            </div>

            {/* Decoration Elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] border border-gray-100 rounded-full -z-10 animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-slate-200/60">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4">How PropProof Works</h2>
            <p className="text-gray-600">Three steps to a bulletproof reputation in the trading world.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center text-blue-600 mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3">1. Connect Sources</h3>
              <p className="text-gray-600 leading-relaxed">Paste your wallet address or link your Rise identifier. We don&apos;t need keys, just public IDs.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="bg-indigo-50 w-12 h-12 rounded-xl flex items-center justify-center text-indigo-600 mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3">2. Auto-Verify</h3>
              <p className="text-gray-600 leading-relaxed">Our engine matches inbound transfers from known prop firm wallets to your verified track record.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-gray-100 hover:shadow-xl transition-shadow">
              <div className="bg-purple-50 w-12 h-12 rounded-xl flex items-center justify-center text-purple-600 mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-3">3. Share Proof</h3>
              <p className="text-gray-600 leading-relaxed">Get your custom propproof.com/handle link and verified badge to display on X, Discord, or your bio.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Leaderboard Preview */}
      <section id="leaderboard" className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-2xl font-bold">Top Verified Traders</h2>
              <p className="text-gray-500">Ranked by total historical payouts</p>
            </div>
            <Link href="#leaderboard" className="text-sm font-semibold text-black hover:underline underline-offset-4 flex items-center gap-1">
              View full leaderboard
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

          <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rank</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Trader</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Verified Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topTraders.map((trader, idx) => (
                  <tr key={trader.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-5">
                      <span className="text-lg font-bold text-gray-300">#{idx + 1}</span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <Image
                          src={trader.avatarUrl}
                          alt={trader.displayName}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-full border border-gray-200 object-cover"
                        />
                        <div>
                          <div className="font-bold flex items-center gap-1">
                            {trader.displayName}
                            <svg className="w-3 h-3 text-blue-500 fill-blue-500" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="text-xs text-gray-400">@{trader.handle}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right font-bold text-lg">
                      ${trader.totalVerifiedPayout.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="create" className="py-24 px-4">
        <div className="max-w-5xl mx-auto bg-black rounded-3xl p-12 md:p-20 text-center relative overflow-hidden">
          {/* Subtle noise/gradient effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800/20 to-transparent pointer-events-none"></div>

          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 relative z-10">Ready to prove your payouts?</h2>
          <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto relative z-10">
            Join 500+ verified traders using PropProof to build their professional reputation.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
            <Link
              href="#create"
              className="bg-white text-black px-8 py-4 rounded-xl font-bold hover:bg-gray-100 transition-all shadow-lg"
            >
              Get Verified Now
            </Link>
            <Link
              href="#search"
              className="bg-gray-900 text-white border border-gray-800 px-8 py-4 rounded-xl font-bold hover:bg-gray-800 transition-all"
            >
              Check a Trader
            </Link>
          </div>
        </div>
      </section>
      </div>
    </PropProofLayout>
  );
};

export default PropProofLanding;
