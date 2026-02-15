"use client";

const CATEGORY_MAP = {
  OPERATIONAL: { label: "Operational", classes: "bg-blue-50 text-blue-600 border-blue-100" },
  REPUTATION: { label: "Reputation", classes: "bg-amber-50 text-amber-600 border-amber-100" },
  REGULATORY: { label: "Regulatory", classes: "bg-slate-50 text-slate-600 border-slate-100" },
};

function SourceLinkIcon({ className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

/**
 * @param {{ item: import("../../../app/propfirms/[id]/intelligence/types").IntelligenceItem }} props
 */
export default function IntelligenceCard({ item }) {
  const category = CATEGORY_MAP[item.category] || {
    label: item.category,
    classes: "bg-slate-50 text-slate-600 border-slate-100",
  };
  const isReputation = item.category === "REPUTATION";
  const isHighConfidence = item.confidence === "HIGH";
  const dotColor = isReputation && isHighConfidence ? "bg-red-500" : "bg-emerald-500";

  return (
    <div className="relative flex gap-4">
      {/* Timeline dot */}
      <div className="shrink-0 w-4 flex justify-center pt-3.5" aria-hidden>
        <span className={`block w-2.5 h-2.5 rounded-full ${dotColor}`} />
      </div>

      {/* Card */}
      <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all group">
        {/* Header: category badge + title + date */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded border uppercase tracking-tight ${category.classes}`}
            >
              {category.label}
            </span>
            <h3 className="text-base font-bold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors truncate">
              {item.title}
            </h3>
          </div>
          <span className="shrink-0 text-xs font-medium text-slate-400 mt-0.5">{item.date}</span>
        </div>

        {/* Summary — full text, wrap long words to avoid overflow */}
        <div className="mb-3 min-w-0">
          <p className="text-sm text-slate-500 leading-relaxed font-medium break-words">{item.summary}</p>
        </div>

        {/* References */}
        {item.sources?.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-50">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
              References:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {item.sources.slice(0, 3).map((source) => (
                <a
                  key={source.id}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-all"
                >
                  <SourceLinkIcon />
                  {source.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
