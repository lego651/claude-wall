"use client";

/**
 * Loading skeleton that mirrors IntelligenceCard layout:
 * timeline dot, card with header (category + title + date), summary, optional references row.
 */
export default function IntelligenceCardSkeleton() {
  return (
    <div className="relative flex gap-4">
      {/* Timeline dot — visible gray circle so line shows as timeline */}
      <div className="shrink-0 w-4 flex justify-center pt-3.5" aria-hidden>
        <span className="block w-2.5 h-2.5 rounded-full bg-slate-400 animate-pulse" />
      </div>

      {/* Card skeleton */}
      <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl p-4">
        {/* Header: category badge + title + date */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-5 w-16 bg-slate-200 rounded animate-pulse shrink-0" />
            <div className="h-4 w-2/3 max-w-xs bg-slate-200 rounded animate-pulse" />
          </div>
          <div className="h-3.5 w-14 bg-slate-100 rounded animate-pulse shrink-0 mt-0.5" />
        </div>

        {/* Summary */}
        <div className="mb-3 min-w-0 space-y-2">
          <div className="h-3.5 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-3.5 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-3.5 w-4/5 bg-slate-100 rounded animate-pulse" />
        </div>

        {/* References row */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-50">
          <div className="h-3 w-20 bg-slate-100 rounded animate-pulse" />
          <div className="flex gap-1.5" data-testid="skeleton-ref-pills">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-6 w-24 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
