import Link from "next/link";
import { strategies, getFeaturedStrategies, getAllTags } from "./_assets/strategies";
import { getSEOTags } from "@/libs/seo";
import Footer from "@/components/Footer";

export const metadata = getSEOTags({
  title: "Trading Strategies | Proven Prop Firm Systems",
  description: "Explore proven trading strategies with backtested results, risk management frameworks, and real-world performance data for prop firm traders.",
  canonicalUrlRelative: "/strategies",
});

function StrategyCard({ strategy }) {
  const difficultyColors = {
    Beginner: "badge-success",
    Intermediate: "badge-warning",
    Advanced: "badge-error",
  };

  return (
    <Link href={`/strategies/public/${strategy.slug}`} className="block group">
      <div className="card bg-base-200 hover:bg-base-300 transition-all duration-200 card-border group-hover:shadow-lg h-full">
        <div className="card-body">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="card-title text-xl mb-2 group-hover:text-primary transition-colors">
                {strategy.title}
              </h3>
              <p className="text-sm text-base-content/70 line-clamp-2">
                {strategy.description}
              </p>
            </div>
            {strategy.featured && (
              <div className="badge badge-primary badge-sm ml-2">Featured</div>
            )}
          </div>

          <div className="space-y-2 my-4 text-sm">
            <div className="flex justify-between">
              <span className="text-base-content/70">Instrument:</span>
              <span className="font-medium">{strategy.instrument}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-base-content/70">Session:</span>
              <span className="font-medium">{strategy.session}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-base-content/70">Time/Day:</span>
              <span className="font-medium">{strategy.timeCommitment}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 my-4">
            <div className="p-3 rounded-lg bg-success/10">
              <div className="text-xs text-base-content/70 mb-1">Win Rate</div>
              <div className="text-lg font-bold text-success">{strategy.summary.winRate}</div>
            </div>
            <div className="p-3 rounded-lg bg-base-300">
              <div className="text-xs text-base-content/70 mb-1">Risk/Trade</div>
              <div className="text-lg font-bold">{strategy.summary.avgRisk}</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {strategy.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="badge badge-sm badge-outline">
                {tag}
              </span>
            ))}
            {strategy.tags.length > 3 && (
              <span className="badge badge-sm badge-ghost">
                +{strategy.tags.length - 3}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between mt-auto pt-4 border-t border-base-content/10">
            <div className={`badge ${difficultyColors[strategy.difficulty] || "badge-ghost"}`}>
              {strategy.difficulty}
            </div>
            <span className="text-sm text-primary group-hover:underline inline-flex items-center gap-1">
              View Strategy
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function StrategiesPage() {
  const featuredStrategies = getFeaturedStrategies();
  const allStrategies = strategies;
  const tags = getAllTags();

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* HEADER */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            📈 Trading Strategies
          </h1>
          <p className="text-lg text-base-content/70 max-w-3xl">
            Proven trading strategies with backtested results, risk management frameworks, and real-world performance tracking.
            Built for prop firm traders who value <strong>process over profits</strong>.
          </p>
        </div>

        {/* FEATURED STRATEGIES */}
        {featuredStrategies.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-3">
              <span>⭐ Featured Strategies</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
              {featuredStrategies.map((strategy) => (
                <StrategyCard key={strategy.slug} strategy={strategy} />
              ))}
            </div>
          </section>
        )}

        {/* ALL STRATEGIES */}
        {allStrategies.length > featuredStrategies.length && (
          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-3">
              <span>📚 All Strategies</span>
              <span className="badge badge-lg">{allStrategies.length}</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allStrategies
                .filter(s => !s.featured)
                .map((strategy) => (
                  <StrategyCard key={strategy.slug} strategy={strategy} />
                ))}
            </div>
          </section>
        )}

        {/* EMPTY STATE */}
        {allStrategies.length === 0 && (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📈</div>
            <h3 className="text-2xl font-bold mb-2">No Strategies Yet</h3>
            <p className="text-base-content/70">
              Trading strategies will appear here once they are published.
            </p>
          </div>
        )}

        {/* TAGS FILTER (for future) */}
        {tags.length > 0 && (
          <section className="mt-16 pt-8 border-t border-base-content/10">
            <h3 className="text-xl font-bold mb-4">Browse by Tag</h3>
            <div className="flex flex-wrap gap-3">
              {tags.map((tag) => (
                <div key={tag} className="badge badge-lg badge-outline">
                  {tag}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="mt-16 pt-8 border-t border-base-content/10">
          <div className="card bg-gradient-to-br from-primary/20 to-primary/5 card-border">
            <div className="card-body text-center">
              <h3 className="text-2xl font-bold mb-2">Want to Track Your Trading?</h3>
              <p className="text-base-content/70 mb-4">
                View detailed performance reports with R-multiples, win rates, and strategy breakdowns.
              </p>
              <Link href="/reports" className="btn btn-primary">
                View Trading Reports →
              </Link>
            </div>
          </div>
        </section>
      </div>
      <Footer />
    </>
  );
}
