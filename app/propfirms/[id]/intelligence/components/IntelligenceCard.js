"use client";

import { THEME } from "@/lib/theme";

// Small solid dot ~6–8px to match design
const DOT_SIZE = "w-2 h-2"; // 8px

/** Format YYYY-MM-DD to "Jan 22, 2025" for display */
function formatSourceDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Globe icon to imply source is from website — light grey/slate outline, no green */
function SourceIcon({ className }) {
  return (
    <div
      className={`flex-shrink-0 rounded flex items-center justify-center w-8 h-8 bg-slate-100 text-slate-500 ${className ?? ""}`}
      aria-hidden
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
        />
      </svg>
    </div>
  );
}

/**
 * @param {{ item: import("../types").IntelligenceItem; isLast: boolean }} props
 */
export default function IntelligenceCard({ item, isLast }) {
  const isHighConfidence = item.confidence === "HIGH";
  const isReputation = item.category === "REPUTATION";

  return (
    <div className="relative flex gap-6 pb-8 last:pb-0">
      {/* Timeline dot: small solid circle (~8px), red or green */}
      <div className="relative z-10 flex-shrink-0 w-3 flex justify-center mt-1.5">
        <span
          className={`block ${DOT_SIZE} rounded-full ${
            isHighConfidence && isReputation ? "bg-red-500" : "bg-emerald-500"
          }`}
          aria-hidden
        />
      </div>

      {/* Card */}
      <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
            {item.category} · {item.date}
          </p>
          <span
            className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded ${
              item.confidence === "HIGH"
                ? "bg-blue-600 text-white"
                : item.confidence === "MEDIUM"
                  ? "bg-slate-200 text-slate-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            CONFIDENCE: {item.confidence}
          </span>
        </div>
        <h3 className="font-bold text-slate-900 text-lg mb-2">{item.title}</h3>
        <p className="text-slate-600 text-sm leading-relaxed mb-4">
          {item.summary}
        </p>
        {item.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {item.sources?.length > 0 && (
          <>
            <hr className="border-slate-200 my-4" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">
              Supporting evidence
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {item.sources.slice(0, 3).map((src, idx) => (
                <a
                  key={src.id}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-left relative group"
                >
                  <SourceIcon />
                  <div className="min-w-0 flex-1 pr-5">
                    <span className="font-bold text-slate-900 text-sm block">
                      {src.label}
                    </span>
                    {(src.domain || src.date) && (
                      <span className="text-slate-500 text-xs mt-0.5 block">
                        {src.domain}
                        {src.date ? ` · ${formatSourceDate(src.date)}` : ""}
                      </span>
                    )}
                  </div>
                  <svg
                    className="absolute top-3 right-3 w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
