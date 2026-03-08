"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

export default function TrustpilotSparkline({ firmId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v2/propfirms/${firmId}/trustpilot-trend`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [firmId]);

  if (loading) {
    return <div className="animate-pulse h-14 bg-slate-100 rounded-lg" />;
  }

  const weeks = data?.weeks ?? [];
  if (weeks.length < 2) {
    return (
      <p className="text-[10px] text-slate-400 italic text-center py-2">
        Trend data building...
      </p>
    );
  }

  const latestWeek = weeks[0]; // DESC order — first = most recent
  const weeklyAvg = latestWeek?.avg_rating;
  const overall = data?.overall_score;
  const delta = weeklyAvg != null && overall != null ? +(weeklyAvg - overall).toFixed(1) : null;

  let deltaColor = "text-slate-400";
  if (delta !== null) {
    if (delta > 0) deltaColor = "text-emerald-500";
    else if (delta < -0.3) deltaColor = "text-red-500";
  }

  // Reverse to oldest-first for chart display
  const chartData = [...weeks].reverse().map((w) => ({ avg: w.avg_rating }));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          Trustpilot Trend
        </div>
        {delta !== null && (
          <span className={`text-[10px] font-bold ${deltaColor}`}>
            {delta > 0 ? "+" : ""}{delta} vs avg
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={36}>
        <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="avg"
            stroke="#6366f1"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-slate-400">
          This week:{" "}
          <strong className="text-slate-600">{weeklyAvg != null ? weeklyAvg.toFixed(1) : "—"}</strong>
        </span>
        <span className="text-[10px] text-slate-400">
          Overall:{" "}
          <strong className="text-slate-600">{overall != null ? overall.toFixed(1) : "—"}</strong>
        </span>
      </div>
    </div>
  );
}
