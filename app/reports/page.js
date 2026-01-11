import Link from "next/link";
import { reports, getAllYears, getReportsByYear, reportTypes } from "./_assets/reports";
import { getSEOTags } from "@/libs/seo";
import Footer from "@/components/Footer";

export const metadata = getSEOTags({
  title: "Trading Logs | Performance Reports",
  description: "View detailed trading performance reports with R-multiples, win rates, and strategy breakdowns.",
  canonicalUrlRelative: "/reports",
});

function ReportCard({ report }) {
  const totalRColor = report.summary.totalR > 0 ? 'text-success' : 'text-error';
  const totalRBg = report.summary.totalR > 0 ? 'bg-success/10' : 'bg-error/10';

  return (
    <Link href={`/reports/${report.slug}`} className="block group">
      <div className="card bg-base-200 hover:bg-base-300 transition-all duration-200 card-border group-hover:shadow-lg">
        <div className="card-body">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="card-title text-xl mb-1">{report.title}</h3>
              <p className="text-sm text-base-content/70">{report.period}</p>
            </div>
            <div className={`badge badge-lg ${report.type === reportTypes.weekly ? 'badge-primary' : 'badge-secondary'}`}>
              {report.type === reportTypes.weekly ? 'Weekly' : 'Monthly'}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className={`p-3 rounded-lg ${totalRBg}`}>
              <div className="text-xs text-base-content/70 mb-1">Total R</div>
              <div className={`text-lg font-bold ${totalRColor}`}>
                {report.summary.totalR > 0 ? '+' : ''}{report.summary.totalR}R
              </div>
            </div>
            <div className="p-3 rounded-lg bg-base-300">
              <div className="text-xs text-base-content/70 mb-1">Win Rate</div>
              <div className="text-lg font-bold">{report.summary.winRate}%</div>
            </div>
            <div className="p-3 rounded-lg bg-base-300">
              <div className="text-xs text-base-content/70 mb-1">Trades</div>
              <div className="text-lg font-bold">{report.summary.totalTrades}</div>
            </div>
          </div>

          <div className="mt-3 text-sm text-base-content/70">
            <span className="font-medium">Best Day:</span> {report.summary.bestDay}
          </div>

          <div className="card-actions justify-end mt-4">
            <span className="text-sm text-primary group-hover:underline inline-flex items-center gap-1">
              View Full Report
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

export default function TradingLogsPage() {
  const years = getAllYears();
  const weeklyReports = reports.filter(r => r.type === reportTypes.weekly);
  const monthlyReports = reports.filter(r => r.type === reportTypes.monthly);

  // Calculate aggregate stats
  const totalR = reports.reduce((sum, r) => sum + r.summary.totalR, 0);
  const avgWinRate = reports.reduce((sum, r) => sum + r.summary.winRate, 0) / reports.length;
  const totalTrades = reports.reduce((sum, r) => sum + r.summary.totalTrades, 0);

  return (
    <>
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* HEADER */}
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
          📊 Trading Performance Reports
        </h1>
        <p className="text-lg text-base-content/70 max-w-2xl">
          Detailed weekly and monthly trading reports tracking R-multiples across 6 strategies.
          View comprehensive breakdowns, strategy performance, and key insights.
        </p>
      </div>

      {/* AGGREGATE STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="card bg-gradient-to-br from-success/20 to-success/5 card-border">
          <div className="card-body">
            <div className="text-sm text-base-content/70 mb-2">Total R (All Time)</div>
            <div className="text-3xl font-bold text-success">
              +{totalR.toFixed(2)}R
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-primary/20 to-primary/5 card-border">
          <div className="card-body">
            <div className="text-sm text-base-content/70 mb-2">Average Win Rate</div>
            <div className="text-3xl font-bold text-primary">
              {avgWinRate.toFixed(1)}%
            </div>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-info/20 to-info/5 card-border">
          <div className="card-body">
            <div className="text-sm text-base-content/70 mb-2">Total Trades</div>
            <div className="text-3xl font-bold text-info">
              {totalTrades}
            </div>
          </div>
        </div>
      </div>

      {/* WEEKLY REPORTS */}
      {weeklyReports.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-3">
            <span>📅 Weekly Reports</span>
            <span className="badge badge-lg">{weeklyReports.length}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {weeklyReports
              .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
              .map((report) => (
                <ReportCard key={report.slug} report={report} />
              ))}
          </div>
        </section>
      )}

      {/* MONTHLY REPORTS */}
      {monthlyReports.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-3">
            <span>📆 Monthly Reports</span>
            <span className="badge badge-lg">{monthlyReports.length}</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {monthlyReports
              .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
              .map((report) => (
                <ReportCard key={report.slug} report={report} />
              ))}
          </div>
        </section>
      )}

      {/* EMPTY STATE */}
      {reports.length === 0 && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-2xl font-bold mb-2">No Reports Yet</h3>
          <p className="text-base-content/70">
            Trading reports will appear here once they are generated.
          </p>
        </div>
      )}

      {/* YEAR ARCHIVE (for future) */}
      {years.length > 1 && (
        <section className="mt-16 pt-8 border-t border-base-content/10">
          <h3 className="text-xl font-bold mb-4">Browse by Year</h3>
          <div className="flex flex-wrap gap-3">
            {years.map((year) => {
              const yearReports = getReportsByYear(year);
              return (
                <div key={year} className="badge badge-lg badge-outline">
                  {year} ({yearReports.length})
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
    <Footer />
    </>
  );
}
