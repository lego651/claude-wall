"use client";

const CONTENT_TYPE_MAP = {
  company_news: {
    label: "Company News",
    dot: "bg-indigo-500",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-100",
  },
  rule_change: {
    label: "Rule Change",
    dot: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 border-amber-100",
  },
  promotion: {
    label: "Promo",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  other: {
    label: "Update",
    dot: "bg-slate-400",
    badge: "bg-slate-50 text-slate-600 border-slate-100",
  },
};

const SOURCE_TYPE_LABELS = {
  firm_email: "Email",
  manual_upload: "Admin",
  discord: "Discord",
  twitter: "Twitter",
  reddit: "Reddit",
  blog: "Blog",
  other: "Other",
};

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Single item in the company feed timeline.
 * @param {{ item: { id: number, content_type: string, title: string, ai_summary: string, source_type: string, content_date: string } }} props
 */
export default function TimelineItem({ item }) {
  const typeConfig = CONTENT_TYPE_MAP[item.content_type] || CONTENT_TYPE_MAP.other;
  const sourceLabel = SOURCE_TYPE_LABELS[item.source_type] || item.source_type || "Other";

  return (
    <div className="relative flex gap-4">
      {/* Timeline dot */}
      <div className="shrink-0 w-4 flex justify-center pt-3.5" aria-hidden>
        <span className={`block w-2.5 h-2.5 rounded-full ${typeConfig.dot}`} />
      </div>

      {/* Card */}
      <div className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all group">
        {/* Header: badge + title + date */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded border uppercase tracking-tight ${typeConfig.badge}`}
            >
              {typeConfig.label}
            </span>
            <h3 className="text-base font-bold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors truncate">
              {item.title}
            </h3>
          </div>
          <time
            className="shrink-0 text-xs text-slate-400 font-medium whitespace-nowrap"
            dateTime={item.content_date}
          >
            {formatDate(item.content_date)}
          </time>
        </div>

        {/* AI summary */}
        {item.ai_summary && (
          <p className="text-sm text-slate-600 leading-relaxed mb-3">{item.ai_summary}</p>
        )}

        {/* Source tag */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-medium">Source:</span>
          <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">
            {sourceLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
