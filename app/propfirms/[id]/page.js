"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { THEME } from "@/lib/theme";
import { timeSince } from "@/lib/utils/timeSince";

const PERF_PERIODS = [
  { value: "30d", label: "30 Days" },
  { value: "12m", label: "12 Months" },
];

export default function PropFirmOverviewPage() {
  const params = useParams();
  const firmId = params?.id;
  const [perfPeriod, setPerfPeriod] = useState("30d");

  const [chartData, setChartData] = useState(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState(null);

  const [signals, setSignals] = useState(null);
  const [signalsLoading, setSignalsLoading] = useState(true);

  const [incidents, setIncidents] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);

  useEffect(() => {
    if (!firmId) return;
    let cancelled = false;
    setChartLoading(true);
    setChartError(null);
    fetch(`/api/v2/propfirms/${firmId}/chart?period=${perfPeriod}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load chart");
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setChartData(data);
      })
      .catch((err) => {
        if (!cancelled) setChartError(err.message);
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [firmId, perfPeriod]);

  useEffect(() => {
    if (!firmId) return;
    let cancelled = false;
    setSignalsLoading(true);
    fetch(`/api/v2/propfirms/${firmId}/signals?days=30`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setSignals(data);
      })
      .finally(() => {
        if (!cancelled) setSignalsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [firmId]);

  useEffect(() => {
    if (!firmId) return;
    let cancelled = false;
    setIncidentsLoading(true);
    fetch(`/api/v2/propfirms/${firmId}/incidents?days=90`)
      .then((r) => (r.ok ? r.json() : { incidents: [] }))
      .then((data) => {
        if (!cancelled) setIncidents(data.incidents || []);
      })
      .finally(() => {
        if (!cancelled) setIncidentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [firmId]);

  const firm = chartData?.firm;
  const summary = chartData?.summary;
  const chart = chartData?.chart;
  const chartBuckets = chart?.data || [];
  const hasRise = chartBuckets.some((b) => (b.rise || 0) > 0);
  const hasCrypto = chartBuckets.some((b) => (b.crypto || 0) > 0);
  const hasWire = chartBuckets.some((b) => (b.wire || 0) > 0);
  const riseOnly = !hasCrypto && !hasWire;

  const formatCurrency = (val) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(val || 0);

  const formatShort = (val) => {
    if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
    return formatCurrency(val);
  };

  // Loading skeleton
  if (chartLoading && !chartData) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
          <div className="flex gap-2 p-1.5 bg-slate-100 rounded-[20px]">
            <div className="h-10 w-24 bg-slate-200 rounded-[16px] animate-pulse" />
            <div className="h-10 w-24 bg-slate-200 rounded-[16px] animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white p-6 rounded-xl border border-slate-200 animate-pulse"
            >
              <div className="h-3 w-20 bg-slate-200 rounded mb-4" />
              <div className="h-7 w-24 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 h-[350px] animate-pulse" />
      </div>
    );
  }

  if (chartError && !chartData) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-600">Error loading overview: {chartError}</p>
      </div>
    );
  }

  const intelligenceDotClass = (s) =>
    s === "high" ? "bg-rose-500 animate-pulse" : s === "medium" ? "bg-amber-500" : "bg-emerald-500";
  const intelligenceBadgeClass = (s) =>
    s === "high" ? "bg-rose-100 text-rose-600" : s === "medium" ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600";

  return (
    <div className="space-y-6">
      {/* Performance Intelligence row: heading + 30 Days / 12 Months */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-900">Performance Intelligence</h2>
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden />
        </div>
        <div
          className="inline-flex rounded-xl p-1"
          style={{
            backgroundColor: "#F8F8F8",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          {PERF_PERIODS.map((p) => {
            const isSelected = perfPeriod === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPerfPeriod(p.value)}
                className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition-all"
                style={
                  isSelected
                    ? {
                        backgroundColor: "#EAE8FC",
                        color: "#6B5EE1",
                      }
                    : {
                        backgroundColor: "transparent",
                        color: "#4A4A4A",
                      }
                }
              >
                {p.value === "30d" ? (
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="4" y="14" width="4" height="6" rx="1" />
                    <rect x="10" y="9" width="4" height="11" rx="1" />
                    <rect x="16" y="5" width="4" height="15" rx="1" />
                  </svg>
                )}
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Old four stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
              Total Verified
            </span>
            <div className="p-2 bg-slate-50 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: THEME.primary }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900 tracking-tight">{formatShort(summary?.totalPayouts)}</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
              No. of payouts
            </span>
            <div className="p-2 bg-slate-50 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: THEME.primary }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900 tracking-tight">
            {summary?.payoutCount != null ? summary.payoutCount.toLocaleString() : "—"}
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
              Avg. Payout
            </span>
            <div className="p-2 bg-slate-50 rounded-lg">
              <svg className="w-4 h-4" style={{ color: THEME.primary }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900 tracking-tight" style={{ color: THEME.primary }}>{formatCurrency(summary?.avgPayout)}</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
              Time since last payout
            </span>
            <div className="p-2 bg-slate-50 rounded-lg">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900 tracking-tight">{timeSince(summary?.latestPayoutAt) || "—"}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Total Payouts</h2>
        <p className="text-[11px] font-extrabold tracking-wider text-slate-400 uppercase mb-4">
          UTC TIMEZONE
        </p>
        {(riseOnly ? hasRise : hasRise || hasCrypto || hasWire) && (
          <div className="flex items-center gap-5 mb-4">
            {!riseOnly && hasCrypto && (
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                Crypto
              </span>
            )}
            {hasRise && (
              <span className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Rise
              </span>
            )}
            {!riseOnly && hasWire && (
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                Wire
              </span>
            )}
          </div>
        )}
        {chartBuckets.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={chartBuckets}
              margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
              barGap={0}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey={chart?.bucketType === "daily" ? "date" : "month"}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                dy={10}
                tickFormatter={(value) => {
                  if (chart?.bucketType === "daily") {
                    const date = new Date(value);
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                  }
                  return value;
                }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickFormatter={(v) => {
                  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
                  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
                  return `$${v}`;
                }}
              />
              <Tooltip
                formatter={(value) => `$${Number(value).toLocaleString()}`}
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.75rem",
                  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                }}
                cursor={{ fill: "#f1f5f9" }}
              />
              {riseOnly ? (
                hasRise && (
                  <Bar
                    dataKey="rise"
                    fill="#3b82f6"
                    radius={[6, 6, 0, 0]}
                    name="Rise"
                  />
                )
              ) : (
                <>
                  {hasRise && (
                    <Bar
                      dataKey="rise"
                      stackId="a"
                      fill="#3b82f6"
                      radius={[6, 6, 0, 0]}
                      name="Rise"
                    />
                  )}
                  {hasCrypto && (
                    <Bar
                      dataKey="crypto"
                      stackId="a"
                      fill="#f59e0b"
                      radius={[6, 6, 0, 0]}
                      name="Crypto"
                    />
                  )}
                  {hasWire && (
                    <Bar
                      dataKey="wire"
                      stackId="a"
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                      name="Wire"
                    />
                  )}
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-slate-500 text-sm">
            No payout data for this period
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Intelligence Feed</h3>
          <Link href={`/propfirms/${firmId}/intelligence`} className="text-[10px] font-bold text-slate-300 hover:text-slate-500 transition-colors">Live Reports</Link>
        </div>
        {incidentsLoading ? (
          <div className="py-8 text-center">
            <span className="loading loading-spinner loading-sm" />
          </div>
        ) : incidents.length > 0 ? (
          <div className="flex flex-col gap-3">
            {incidents.slice(0, 3).map((inc) => (
              <div
                key={inc.id}
                className="p-4 bg-slate-50 border border-slate-100 rounded-xl transition-all hover:bg-white hover:shadow-md hover:border-slate-200 cursor-default flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${intelligenceDotClass(inc.severity)}`} />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      {inc.incident_type ? inc.incident_type.replace(/_/g, " ").toUpperCase() : "INCIDENT"}
                    </span>
                    <span className="text-[9px] text-slate-300 font-medium ml-1">Detected: {inc.week_start}</span>
                  </div>
                  <h4 className="text-[14px] font-bold text-slate-800 mb-1 leading-tight">{inc.title}</h4>
                  <p className="text-[12px] text-slate-500 leading-normal max-w-3xl">{inc.summary}</p>
                </div>
                <div className="shrink-0 flex items-center">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${intelligenceBadgeClass(inc.severity)}`}>
                    {inc.severity} severity
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 py-4">No recent incidents in the last 90 days.</p>
        )}
      </div>
    </div>
  );
}
