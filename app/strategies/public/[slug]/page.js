import { notFound } from "next/navigation";
import { getStrategyBySlug } from "../../_assets/strategies";
import { getSEOTags } from "@/libs/seo";
import { promises as fs } from "fs";
import path from "path";
import MarkdownRenderer from "@/app/reports/_assets/components/MarkdownRenderer";
import Link from "next/link";
import Footer from "@/components/Footer";

// Generate metadata for SEO
export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const strategy = getStrategyBySlug(resolvedParams.slug);

  if (!strategy) {
    return getSEOTags({
      title: "Strategy Not Found",
      description: "The requested trading strategy could not be found.",
    });
  }

  return getSEOTags({
    title: `${strategy.title} | Trading Strategy`,
    description: strategy.description,
    canonicalUrlRelative: `/strategies/public/${resolvedParams.slug}`,
  });
}

// Main page component
export default async function PublicStrategyPage({ params }) {
  const resolvedParams = await params;
  const strategy = getStrategyBySlug(resolvedParams.slug);

  if (!strategy) {
    notFound();
  }

  // Read markdown content
  const markdownPath = path.join(
    process.cwd(),
    "app",
    "strategies",
    "_assets",
    `${strategy.slug}.md`
  );

  let content = "";
  try {
    content = await fs.readFile(markdownPath, "utf8");
  } catch (error) {
    console.error(`Failed to load strategy markdown: ${error}`);
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold mb-4">Strategy Content Not Found</h1>
        <p className="text-base-content/70 mb-6">
          The strategy file could not be loaded.
        </p>
        <Link href="/strategies" className="btn btn-primary">
          Back to Strategies
        </Link>
      </div>
    );
  }

  const difficultyColors = {
    Beginner: "badge-success",
    Intermediate: "badge-warning",
    Advanced: "badge-error",
  };

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* BREADCRUMB */}
        <div className="mb-6 text-sm">
          <Link href="/strategies" className="text-primary hover:underline">
            ← Back to Strategies
          </Link>
        </div>

        {/* STRATEGY HEADER CARD */}
        <div className="card bg-gradient-to-br from-primary/10 to-primary/5 card-border mb-8">
          <div className="card-body">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
                    {strategy.title}
                  </h1>
                  {strategy.featured && (
                    <div className="badge badge-primary">Featured</div>
                  )}
                </div>
                <p className="text-base-content/80 text-lg">
                  {strategy.description}
                </p>
              </div>
              <div className={`badge badge-lg ${difficultyColors[strategy.difficulty]}`}>
                {strategy.difficulty}
              </div>
            </div>

            {/* METADATA GRID */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <div>
                <div className="text-xs text-base-content/70 mb-1">Instrument</div>
                <div className="font-bold">{strategy.instrument}</div>
              </div>
              <div>
                <div className="text-xs text-base-content/70 mb-1">Session</div>
                <div className="font-bold">{strategy.session}</div>
              </div>
              <div>
                <div className="text-xs text-base-content/70 mb-1">Time/Day</div>
                <div className="font-bold">{strategy.timeCommitment}</div>
              </div>
              <div>
                <div className="text-xs text-base-content/70 mb-1">Win Rate</div>
                <div className="font-bold text-success">{strategy.summary.winRate}</div>
              </div>
            </div>

            {/* TAGS */}
            <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-base-content/10">
              {strategy.tags.map((tag) => (
                <span key={tag} className="badge badge-outline">
                  {tag}
                </span>
              ))}
            </div>

            {/* META INFO */}
            <div className="flex flex-wrap items-center gap-4 mt-6 pt-6 border-t border-base-content/10 text-sm text-base-content/70">
              <span>Published: {new Date(strategy.publishedAt).toLocaleDateString()}</span>
              {strategy.updatedAt !== strategy.publishedAt && (
                <span>Updated: {new Date(strategy.updatedAt).toLocaleDateString()}</span>
              )}
              <span>Author: {strategy.author}</span>
            </div>
          </div>
        </div>

        {/* KEY METRICS SUMMARY */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card bg-base-200 card-border">
            <div className="card-body p-4">
              <div className="text-xs text-base-content/70 mb-1">Win Rate</div>
              <div className="text-2xl font-bold text-success">{strategy.summary.winRate}</div>
            </div>
          </div>
          <div className="card bg-base-200 card-border">
            <div className="card-body p-4">
              <div className="text-xs text-base-content/70 mb-1">Risk/Trade</div>
              <div className="text-2xl font-bold">{strategy.summary.avgRisk}</div>
            </div>
          </div>
          <div className="card bg-base-200 card-border">
            <div className="card-body p-4">
              <div className="text-xs text-base-content/70 mb-1">Max Daily Loss</div>
              <div className="text-2xl font-bold text-error">{strategy.summary.maxDailyLoss}</div>
            </div>
          </div>
          <div className="card bg-base-200 card-border">
            <div className="card-body p-4">
              <div className="text-xs text-base-content/70 mb-1">Expectancy</div>
              <div className="text-2xl font-bold text-primary">{strategy.summary.expectedReturn}</div>
            </div>
          </div>
        </div>

        {/* MARKDOWN CONTENT */}
        <div className="card bg-base-100 card-border mb-8">
          <div className="card-body prose-container">
            <MarkdownRenderer content={content} />
          </div>
        </div>

        {/* BACK BUTTON */}
        <div className="text-center">
          <Link href="/strategies" className="btn btn-outline">
            ← Back to All Strategies
          </Link>
        </div>
      </div>
      <Footer />
    </>
  );
}
