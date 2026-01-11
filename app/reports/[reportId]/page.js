import Link from "next/link";
import { reports, getReportBySlug } from "../_assets/reports";
import MarkdownRenderer from "../_assets/components/MarkdownRenderer";
import { getSEOTags } from "@/libs/seo";

export async function generateMetadata({ params }) {
  const { reportId } = await params;
  const report = getReportBySlug(reportId);

  if (!report) {
    return getSEOTags({
      title: "Report Not Found",
      description: "The requested trading report could not be found.",
    });
  }

  return getSEOTags({
    title: `Trading Report - ${report.title}`,
    description: `Trading performance report for ${report.period}. Total R: ${report.summary.totalR > 0 ? '+' : ''}${report.summary.totalR}R, Win Rate: ${report.summary.winRate}%`,
    canonicalUrlRelative: `/reports/${report.slug}`,
  });
}

export async function generateStaticParams() {
  return reports.map((report) => ({
    reportId: report.slug,
  }));
}

export default async function ReportPage({ params }) {
  const { reportId } = await params;
  const report = getReportBySlug(reportId);

  if (!report) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold mb-4">Report Not Found</h1>
        <p className="text-base-content/70 mb-8">
          The trading report you're looking for doesn't exist.
        </p>
        <Link href="/reports" className="btn btn-primary">
          Back to Reports
        </Link>
      </div>
    );
  }

  const content = report.getContent();

  return (
    <>
      {/* BACK LINK */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link
          href="/reports"
          className="link !no-underline text-base-content/80 hover:text-base-content inline-flex items-center gap-1"
          title="Back to Trading Logs"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M15 10a.75.75 0 01-.75.75H7.612l2.158 1.96a.75.75 0 11-1.04 1.08l-3.5-3.25a.75.75 0 010-1.08l3.5-3.25a.75.75 0 111.04 1.08L7.612 9.25h6.638A.75.75 0 0115 10z"
              clipRule="evenodd"
            />
          </svg>
          Back to Trading Logs
        </Link>
      </div>

      {/* REPORT HEADER */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <span className="badge badge-primary badge-lg">
            {report.type === 'weekly' ? 'Weekly Report' : 'Monthly Report'}
          </span>
          <span className="text-base-content/80">
            {new Date(report.publishedAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card bg-base-200 card-sm">
            <div className="card-body">
              <div className="text-sm text-base-content/70">Total R</div>
              <div className={`text-2xl font-bold ${report.summary.totalR > 0 ? 'text-success' : 'text-error'}`}>
                {report.summary.totalR > 0 ? '+' : ''}{report.summary.totalR}R
              </div>
            </div>
          </div>
          <div className="card bg-base-200 card-sm">
            <div className="card-body">
              <div className="text-sm text-base-content/70">Win Rate</div>
              <div className="text-2xl font-bold">{report.summary.winRate}%</div>
            </div>
          </div>
          <div className="card bg-base-200 card-sm">
            <div className="card-body">
              <div className="text-sm text-base-content/70">Total Trades</div>
              <div className="text-2xl font-bold">{report.summary.totalTrades}</div>
            </div>
          </div>
          <div className="card bg-base-200 card-sm">
            <div className="card-body">
              <div className="text-sm text-base-content/70">Best Day</div>
              <div className="text-lg font-bold">{report.summary.bestDay}</div>
            </div>
          </div>
        </div>
      </div>

      {/* REPORT CONTENT */}
      <article className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="bg-base-100 rounded-lg">
          <MarkdownRenderer content={content} />
        </div>
      </article>
    </>
  );
}
