"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatWeekRange(fromStr, toStr) {
  if (!fromStr || !toStr) return "";
  const from = new Date(fromStr + "T00:00:00");
  const to = new Date(toStr + "T00:00:00");
  const fm = from.getMonth() + 1;
  const fd = String(from.getDate()).padStart(2, "0");
  const tm = to.getMonth() + 1;
  const td = String(to.getDate()).padStart(2, "0");
  return `${fm}/${fd}-${tm}/${td}`;
}

function formatValue(val, dataKey) {
  if (dataKey === "avg_rating") return `${Number(val).toFixed(1)} / 5.0 ★`;
  if (dataKey === "payout_total") {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
    return `$${Number(val).toLocaleString()}`;
  }
  return val;
}

function CustomTooltip({ active, payload, dataKey }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const val = payload[0].value;
  return (
    <div className="bg-slate-800 text-white text-[10px] px-2.5 py-1.5 rounded-lg shadow-lg pointer-events-none">
      <div className="text-slate-400 mb-0.5">
        {formatDate(point.week_from)} – {formatDate(point.week_to)}
      </div>
      <div className="font-bold">{formatValue(val, dataKey)}</div>
    </div>
  );
}

/**
 * WeeklyBarChart — renders a compact bar chart from weekly data.
 * weeks: array in DESC order (most recent first); reversed internally for display.
 * dataKey: the field on each week object to chart.
 */
export default function WeeklyBarChart({ weeks, dataKey, color = "#6366f1", referenceValue }) {
  const chartData = [...weeks].reverse().map((w) => ({
    val: w[dataKey] ?? 0,
    week_from: w.week_from,
    week_to: w.week_to,
    label: formatWeekRange(w.week_from, w.week_to),
  }));

  const values = chartData.map((d) => d.val).filter((v) => v > 0);
  if (referenceValue != null) values.push(referenceValue);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const padding = (max - min) * 0.4 || max * 0.1 || 0.5;
  const yDomain = [Math.max(0, min - padding), max + padding];

  return (
    <ResponsiveContainer width="100%" height={72}>
      <BarChart data={chartData} margin={{ top: 2, right: 4, bottom: 4, left: 4 }} barCategoryGap="35%" barGap={2}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 8.5, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis domain={yDomain} hide />
        <Tooltip
          content={(props) => <CustomTooltip {...props} dataKey={dataKey} />}
          cursor={{ fill: "rgba(0,0,0,0.06)", radius: 3 }}
        />
        <Bar dataKey="val" fill={color} radius={[3, 3, 0, 0]} isAnimationActive={false} maxBarSize={14} />
        {referenceValue != null && (
          <ReferenceLine y={referenceValue} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
