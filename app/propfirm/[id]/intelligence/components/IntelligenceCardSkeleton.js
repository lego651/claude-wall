"use client";

/**
 * Loading skeleton that mirrors IntelligenceCard layout:
 * timeline dot, header (category + confidence), title, summary, tag, separator,
 * "SUPPORTING EVIDENCE" header, three small source card placeholders.
 */
export default function IntelligenceCardSkeleton() {
  return (
    <div className="relative flex gap-6 pb-8 last:pb-0">
      {/* Timeline dot placeholder */}
      <div className="relative z-10 flex-shrink-0 w-3 flex justify-center mt-1.5">
        <span className="block w-2 h-2 rounded-full bg-slate-200 animate-pulse" aria-hidden />
      </div>

      {/* Card skeleton */}
      <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
          <div className="h-5 w-20 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="h-5 w-3/4 max-w-md bg-slate-200 rounded animate-pulse mb-3" />
        <div className="space-y-2 mb-4">
          <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-3 w-2/3 bg-slate-100 rounded animate-pulse" />
        </div>
        <div className="h-6 w-20 bg-slate-100 rounded-md animate-pulse mb-4" />
        <hr className="border-slate-200 my-4" />
        <div className="h-3 w-32 bg-slate-200 rounded animate-pulse mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50/50"
            >
              <div className="w-8 h-8 rounded bg-slate-200 animate-pulse flex-shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-3/4 bg-slate-200 rounded animate-pulse" />
                <div className="h-2.5 w-1/2 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="w-3.5 h-3.5 rounded bg-slate-200 animate-pulse flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
