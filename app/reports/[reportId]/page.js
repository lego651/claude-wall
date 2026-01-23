import Link from "next/link";
import { reports, getReportBySlug } from "../_assets/reports";
import MarkdownRenderer from "../_assets/components/MarkdownRenderer";
import { getSEOTags } from "@/libs/seo";
import AdminLayout from "@/components/AdminLayout";

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
      <AdminLayout>
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-4">Report Not Found</h1>
          <p className="text-gray-600 mb-8">
            The trading report you're looking for doesn't exist.
          </p>
          <Link href="/reports" className="inline-flex items-center gap-2 px-6 py-3 text-white rounded-2xl font-bold transition-colors" style={{ backgroundColor: '#635BFF' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5548E6'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#635BFF'}>
            Back to Reports
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const content = report.getContent();
  const totalRColor = report.summary.totalR > 0 ? 'text-emerald-500' : 'text-rose-500';
  const totalRBg = report.summary.totalR > 0 ? 'bg-emerald-50/50 border-emerald-100' : 'bg-rose-50/50 border-rose-100';

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* BREADCRUMB */}
        <nav className="mb-8 flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
          <Link href="/reports" className="transition-colors hover:text-[#635BFF]">Reports</Link>
          <span>/</span>
          <span className="text-gray-900">{report.title}</span>
        </nav>

        {/* REPORT HEADER */}
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm p-10 mb-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">
                  {report.title}
                </h1>
                <span className="text-white text-[10px] font-black px-3 py-1 rounded-lg shadow-lg uppercase tracking-widest" style={{ backgroundColor: '#635BFF', boxShadow: '0 10px 15px -3px rgba(99, 91, 255, 0.1)' }}>
                  {report.type === 'weekly' ? 'Weekly' : 'Monthly'}
                </span>
              </div>
              <p className="text-lg text-gray-400 font-medium leading-relaxed">
                {report.period}
              </p>
            </div>
            <div className="text-sm font-semibold text-gray-400">
              Published: {new Date(report.publishedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`${totalRBg} border p-8 rounded-[24px] relative overflow-hidden group`}>
              <div className="relative z-10">
                <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Total R</div>
                <div className={`text-3xl font-black ${totalRColor}`}>
                  {report.summary.totalR > 0 ? '+' : ''}{report.summary.totalR}R
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-100 p-8 rounded-[24px] shadow-sm">
              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Win Rate</div>
              <div className="text-3xl font-black" style={{ color: '#635BFF' }}>{report.summary.winRate}%</div>
            </div>

            <div className="bg-white border border-gray-100 p-8 rounded-[24px] shadow-sm">
              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Trades</div>
              <div className="text-3xl font-black text-gray-900">{report.summary.totalTrades}</div>
            </div>

            <div className="bg-white border border-gray-100 p-8 rounded-[24px] shadow-sm">
              <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Best Day</div>
              <div className="text-lg font-black text-emerald-600">{report.summary.bestDay}</div>
            </div>
          </div>
        </div>

        {/* REPORT CONTENT */}
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm p-10 mb-8">
          <style jsx>{`
            .prose a { color: #635BFF; }
            .prose code { color: #635BFF; background-color: rgba(99, 91, 255, 0.1); }
            .prose blockquote { border-left-color: #635BFF; background-color: rgba(99, 91, 255, 0.1); }
          `}</style>
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
            prose-img:rounded-2xl prose-img:shadow-lg
          ">
            <MarkdownRenderer content={content} />
          </div>
        </div>

        {/* CTA SECTION */}
        <div className="rounded-[40px] p-10 text-center shadow-xl mb-8" style={{ background: 'linear-gradient(to bottom right, #635BFF, #5548E6)', boxShadow: '0 20px 25px -5px rgba(99, 91, 255, 0.1)' }}>
          <h3 className="text-3xl font-black text-white mb-3">View All Trading Reports</h3>
          <p className="font-medium mb-8 max-w-xl mx-auto" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
            Explore more weekly and monthly performance reports with detailed strategy breakdowns and analytics.
          </p>
          <Link
            href="/reports"
            className="inline-flex items-center gap-3 px-8 py-4 bg-white rounded-[28px] text-lg font-black shadow-xl hover:scale-105 transition-transform"
            style={{ color: '#635BFF' }}
          >
            Browse All Reports
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>

        {/* BACK BUTTON */}
        <div className="text-center">
          <Link
            href="/reports"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl text-sm font-bold hover:bg-gray-50 hover:border-gray-300 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to All Reports
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
}
