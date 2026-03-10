"use client";

function computeVerdict(incidents) {
  if (!incidents || incidents.length === 0) return "STABLE";
  if (incidents.some((i) => i.severity === "high")) return "ELEVATED";
  if (incidents.some((i) => i.severity === "medium")) return "MONITORING";
  return "STABLE";
}

function topTitles(incidents, count = 2) {
  const negative = incidents.filter((i) => i.severity === "high" || i.severity === "medium");
  return (negative.length > 0 ? negative : incidents).slice(0, count).map((i) => i.title);
}

/**
 * @param {{ incidents: Array }} props - raw API incidents array
 */
export default function VerdictBanner({ incidents }) {
  const verdict = computeVerdict(incidents);

  if (verdict === "ELEVATED") {
    const titles = topTitles(incidents);
    return (
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-200 bg-red-50 mb-6">
        <span className="text-red-500 text-lg leading-none mt-0.5" aria-hidden>⚠</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-red-700">Elevated Risk — Active Issues Detected</p>
          {titles.length > 0 && (
            <p className="text-xs text-red-600 mt-0.5 truncate">{titles.join(" · ")}</p>
          )}
        </div>
      </div>
    );
  }

  if (verdict === "MONITORING") {
    const titles = topTitles(incidents);
    return (
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 mb-6">
        <span className="text-amber-500 text-lg leading-none mt-0.5" aria-hidden>◉</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-amber-700">Monitoring — Issues Worth Watching</p>
          {titles.length > 0 && (
            <p className="text-xs text-amber-600 mt-0.5 truncate">{titles.join(" · ")}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 mb-6">
      <span className="text-emerald-500 text-lg leading-none mt-0.5" aria-hidden>✓</span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-emerald-700">Stable — No Major Issues Detected</p>
        <p className="text-xs text-emerald-600 mt-0.5">No significant risk signals in the last 30 days.</p>
      </div>
    </div>
  );
}
