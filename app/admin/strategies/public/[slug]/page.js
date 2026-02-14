import { notFound } from "next/navigation";
import { getStrategyBySlug } from "@/data/strategies/strategies";
import { getSEOTags } from "@/lib/seo";
import { promises as fs } from "fs";
import path from "path";
import MarkdownRenderer from "@/components/admin/strategies/public/MarkdownRenderer";
import Link from "next/link";
import PropProofLayout from "@/components/common/PropProofLayout";

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
    canonicalUrlRelative: `/admin/strategies/public/${resolvedParams.slug}`,
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
    "data",
    "strategies",
    `${strategy.slug}.md`
  );

  let content = "";
  try {
    content = await fs.readFile(markdownPath, "utf8");
  } catch (error) {
    console.error(`Failed to load strategy markdown: ${error}`);
    return (
      <PropProofLayout>
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-3xl font-bold mb-4">Strategy Content Not Found</h1>
          <p className="text-gray-600 mb-6">
            The strategy file could not be loaded.
          </p>
          <Link href="/admin/strategies" className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-2xl font-bold transition-colors hover:bg-[#5548E6]" style={{ backgroundColor: '#635BFF' }}>
            Back to Strategies
          </Link>
        </div>
      </PropProofLayout>
    );
  }

  const difficultyColors = {
    Beginner: "bg-emerald-50 text-emerald-600 border-emerald-200",
    Intermediate: "bg-amber-50 text-amber-600 border-amber-200",
    Advanced: "bg-rose-50 text-rose-600 border-rose-200",
  };

  return (
    <PropProofLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* BREADCRUMB */}
        <nav className="mb-8 flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
          <Link href="/admin/strategies" className="transition-colors hover:text-[#635BFF]">Strategies</Link>
          <span>/</span>
          <span className="text-gray-900">{strategy.title}</span>
        </nav>

        {/* STRATEGY HEADER SECTION */}
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm p-10 mb-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">
                  {strategy.title}
                </h1>
                {strategy.featured && (
                  <span className="text-white text-[10px] font-black px-3 py-1 rounded-lg shadow-lg uppercase tracking-widest" style={{ backgroundColor: '#635BFF', boxShadow: '0 10px 15px -3px rgba(99, 91, 255, 0.1)' }}>
                    Featured
                  </span>
                )}
              </div>
              <p className="text-lg text-gray-400 font-medium leading-relaxed">
                {strategy.description}
              </p>
            </div>
            <div className={`px-4 py-2 rounded-2xl text-sm font-black border ${difficultyColors[strategy.difficulty]}`}>
              {strategy.difficulty}
            </div>
          </div>

          {/* METADATA GRID */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-8 border-y border-gray-100">
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Instrument</div>
              <div className="text-sm font-black text-gray-900">{strategy.instrument}</div>
            </div>
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Session</div>
              <div className="text-sm font-black text-gray-900">{strategy.session}</div>
            </div>
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Time/Day</div>
              <div className="text-sm font-black text-gray-900">{strategy.timeCommitment}</div>
            </div>
            <div>
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Win Rate</div>
              <div className="text-sm font-black text-emerald-600">{strategy.summary.winRate}</div>
            </div>
          </div>

          {/* TAGS */}
          <div className="flex flex-wrap gap-2 mt-8">
            {strategy.tags.map((tag) => (
              <span key={tag} className="px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-lg text-xs font-black text-gray-500 uppercase tracking-wider">
                {tag}
              </span>
            ))}
          </div>

          {/* META INFO */}
          <div className="flex flex-wrap items-center gap-6 mt-8 pt-8 border-t border-gray-100 text-xs font-semibold text-gray-400">
            <span>Published: {new Date(strategy.publishedAt).toLocaleDateString()}</span>
            {strategy.updatedAt !== strategy.publishedAt && (
              <span>Updated: {new Date(strategy.updatedAt).toLocaleDateString()}</span>
            )}
            <span>Author: {strategy.author}</span>
          </div>
        </div>

        {/* KEY METRICS SUMMARY */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Win Rate</div>
            <div className="text-3xl font-black text-emerald-500">{strategy.summary.winRate}</div>
          </div>
          <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Risk/Trade</div>
            <div className="text-3xl font-black text-gray-900">{strategy.summary.avgRisk}</div>
          </div>
          <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Max Daily Loss</div>
            <div className="text-3xl font-black text-rose-500">{strategy.summary.maxDailyLoss}</div>
          </div>
          <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-6">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Expectancy</div>
            <div className="text-3xl font-black" style={{ color: '#635BFF' }}>{strategy.summary.expectedReturn}</div>
          </div>
        </div>

        {/* MARKDOWN CONTENT */}
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm p-10 mb-8">
          <div className="prose prose-lg max-w-none
            prose-headings:font-black prose-headings:text-gray-900 prose-headings:tracking-tight
            prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl
            prose-p:text-gray-600 prose-p:leading-relaxed
            prose-a:font-semibold prose-a:no-underline hover:prose-a:underline
            prose-strong:text-gray-900 prose-strong:font-black
            prose-ul:text-gray-600 prose-ol:text-gray-600
            prose-li:my-1
            prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-semibold prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-2xl prose-pre:border prose-pre:border-gray-800
            prose-blockquote:rounded-r-2xl prose-blockquote:py-2 prose-blockquote:px-6 prose-blockquote:text-gray-700 prose-blockquote:not-italic
            prose-table:border-collapse prose-table:w-full
            prose-th:bg-gray-50 prose-th:border prose-th:border-gray-200 prose-th:p-3 prose-th:text-left prose-th:text-xs prose-th:font-black prose-th:uppercase prose-th:tracking-wider prose-th:text-gray-500
            prose-td:border prose-td:border-gray-200 prose-td:p-3 prose-td:text-gray-600
            prose-hr:border-gray-200
          ">
            <MarkdownRenderer content={content} />
          </div>
        </div>

        {/* CTA SECTION */}
        <div className="rounded-[40px] p-10 text-center shadow-xl mb-8" style={{ background: 'linear-gradient(to bottom right, #635BFF, #5548E6)', boxShadow: '0 20px 25px -5px rgba(99, 91, 255, 0.1)' }}>
          <h3 className="text-3xl font-black text-white mb-3">Ready to Track This Strategy?</h3>
          <p className="font-medium mb-8 max-w-xl mx-auto" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
            Use our professional-grade performance tracking system to monitor your implementation of this strategy in real-time.
          </p>
          <Link
            href="/admin/portfolio"
            className="inline-flex items-center gap-3 px-8 py-4 bg-white rounded-[28px] text-lg font-black shadow-xl hover:scale-105 transition-transform"
            style={{ color: '#635BFF' }}
          >
            Start Tracking
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>

        {/* BACK BUTTON */}
        <div className="text-center">
          <Link
            href="/admin/strategies"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl text-sm font-bold hover:bg-gray-50 hover:border-gray-300 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to All Strategies
          </Link>
        </div>
      </div>
    </PropProofLayout>
  );
}
