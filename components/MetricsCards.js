"use client";

/**
 * Reusable Metrics Cards Component
 * Displays three key financial metrics: Total Verified, Last 30 Days, and Avg. Payout
 */
export default function MetricsCards({ 
  totalVerified = 0,
  last30Days = 0,
  avgPayout = 0,
  loading = false 
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* Total Verified */}
      <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
            Total Verified
          </p>
          <div className="p-2 bg-slate-50 rounded-lg">
            <svg className="w-4 h-4 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          {loading ? (
            <span className="text-slate-300">Loading...</span>
          ) : (
            `$${totalVerified.toLocaleString()}`
          )}
        </h2>
      </div>

      {/* Last 30 Days */}
      <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
            Last 30 Days
          </p>
          <div className="p-2 bg-slate-50 rounded-lg">
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-emerald-600 tracking-tight">
          {loading ? (
            <span className="text-slate-300">Loading...</span>
          ) : (
            `$${last30Days.toLocaleString()}`
          )}
        </h2>
      </div>

      {/* Avg. Payout */}
      <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
            Avg. Payout
          </p>
          <div className="p-2 bg-slate-50 rounded-lg">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-blue-600 tracking-tight">
          {loading ? (
            <span className="text-slate-300">Loading...</span>
          ) : (
            `$${avgPayout.toLocaleString()}`
          )}
        </h2>
      </div>
    </div>
  );
}
