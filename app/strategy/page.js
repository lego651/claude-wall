import Link from "next/link";
import { strategies, getFeaturedStrategies, getAllTags } from "@/data/strategies/strategies";
import { getSEOTags } from "@/lib/seo";
import PropProofLayout from "@/components/PropProofLayout";

export const metadata = getSEOTags({
  title: "Trading Strategies | Proven Prop Firm Systems",
  description: "Explore proven trading strategies with backtested results, risk management frameworks, and real-world performance data for prop firm traders.",
  canonicalUrlRelative: "/strategy",
});

const MetadataRow = ({ label, value }) => (
  <div className="flex justify-between items-center">
    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
    <span className="text-sm font-black text-gray-900">{value}</span>
  </div>
);

export default function StrategyPage() {
  const featuredStrategies = getFeaturedStrategies();
  const featuredStrategy = featuredStrategies[0]; // Get first featured strategy
  const tags = getAllTags();

  // Extended tags for display (since we might have fewer in data)
  const displayTags = [
    'Futures', 'Gold', 'Prop Firm', 'Risk Management', 'Session Trading',
    'Price Action', 'Indicator Based', 'High Frequency', 'Swing Trading'
  ];

  return (
    <PropProofLayout>
      <div className="space-y-16 max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8">

        {/* Hero Header Section */}
        <section className="text-center space-y-6 relative py-10">
          <div className="absolute inset-0 -top-20 pointer-events-none overflow-hidden opacity-30">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] blur-3xl" style={{ background: 'radial-gradient(circle at center, rgba(99, 91, 255, 0.1) 0%, transparent 70%)' }} />
          </div>

          <div className="relative z-10 flex flex-col items-center gap-4">
            <div className="px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-[0.2em]" style={{ backgroundColor: 'rgba(99, 91, 255, 0.1)', borderColor: 'rgba(99, 91, 255, 0.2)', color: '#635BFF' }}>
              Professional Tooling
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-gray-900 tracking-tight leading-[0.9]">
              📈 Trading Strategies
            </h1>
            <p className="text-lg text-gray-400 font-medium max-w-2xl leading-relaxed">
              Proven trading frameworks with backtested results, risk management guidelines, and real-world performance tracking. Built for traders who value <span className="text-gray-900 font-bold">process over profits</span>.
            </p>
          </div>
        </section>

        {/* Featured Strategy Card */}
        {featuredStrategy && (
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <span className="text-xl">⭐️</span>
              <h2 className="text-2xl font-black text-gray-900">Featured Strategy</h2>
            </div>

            <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden group hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-500 flex flex-col lg:flex-row">
              <div className="p-10 lg:w-3/5 space-y-10">
                <div className="flex flex-wrap items-center gap-4">
                  <h3 className="text-3xl font-black text-gray-900">{featuredStrategy.title}</h3>
                  <span className="text-white text-[10px] font-black px-3 py-1 rounded-lg shadow-lg uppercase tracking-widest" style={{ backgroundColor: '#635BFF', boxShadow: '0 10px 15px -3px rgba(99, 91, 255, 0.1)' }}>Featured</span>
                </div>

                <p className="text-gray-400 font-medium leading-relaxed">
                  {featuredStrategy.description}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <MetadataRow label="Instrument" value={featuredStrategy.instrument} />
                  <MetadataRow label="Session" value={featuredStrategy.session} />
                  <MetadataRow label="Time/Day" value={featuredStrategy.timeCommitment} />
                  <MetadataRow label="Level" value={`${featuredStrategy.difficulty} Friendly`} />
                </div>
              </div>

              <div className="lg:w-2/5 bg-gray-50/50 p-10 flex flex-col justify-between border-l border-gray-50">
                <div className="space-y-6">
                  <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-[32px] text-center group-hover:scale-[1.02] transition-transform">
                    <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Backtested Win Rate</div>
                    <div className="text-5xl font-black text-emerald-500">{featuredStrategy.summary.winRate}</div>
                  </div>

                  <div className="bg-white border border-gray-100 p-8 rounded-[32px] text-center">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Target Risk:Reward</div>
                    <div className="text-3xl font-black text-gray-900">{featuredStrategy.summary.avgRisk}</div>
                  </div>
                </div>

                <div className="pt-10 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {featuredStrategy.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-lg text-[8px] font-black text-gray-500 uppercase tracking-widest">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={`/admin/strategies/public/${featuredStrategy.slug}`}
                    className="bg-gray-900 text-white p-4 rounded-[22px] hover:bg-black transition-all shadow-xl shadow-gray-200 group/btn"
                  >
                    <svg className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tag Cloud Section */}
        <section className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-wide">Browse by Tag</h2>
            <span className="text-xs font-bold text-gray-400">24 Strategies Total</span>
          </div>

          <div className="flex flex-wrap gap-3">
            {displayTags.map(tag => (
              <button key={tag} className="px-6 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-bold text-gray-600 hover:border-[#635BFF] hover:border-opacity-60 hover:text-[#635BFF] hover:bg-[#635BFF] hover:bg-opacity-10 transition-all shadow-sm">
                {tag}
              </button>
            ))}
          </div>
        </section>

        {/* Footer CTA Section */}
        <section className="rounded-[48px] p-12 text-center space-y-8 relative overflow-hidden shadow-2xl" style={{ backgroundColor: '#635BFF', boxShadow: '0 25px 50px -12px rgba(99, 91, 255, 0.25)' }}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl -ml-32 -mb-32" />

          <div className="relative z-10 space-y-4">
            <h2 className="text-4xl font-black text-white tracking-tight">Want to Track Your Trading?</h2>
            <p className="font-medium max-w-xl mx-auto" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
              Get access to professional-grade performance reports, deep-dive R-multiple analytics, and real-time equity curve tracking.
            </p>
          </div>

          <div className="relative z-10 pt-4">
            <Link
              href="/admin/portfolio"
              className="inline-flex items-center gap-3 px-10 py-5 bg-white rounded-[28px] text-lg font-black shadow-xl hover:scale-105 transition-transform"
              style={{ color: '#635BFF' }}
            >
              View Trading Reports
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </section>
      </div>
    </PropProofLayout>
  );
}
