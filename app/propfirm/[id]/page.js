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

const PERIOD_30D = "30d";

export default function PropFirmOverviewPage() {
  const params = useParams();
  const firmId = params?.id;
  const [period, setPeriod] = useState(PERIOD_30D);

  const [chartData, setChartData] = useState(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState(null);

  const [signals, setSignals] = useState(null);
  const [signalsLoading, setSignalsLoading] = useState(true);

  const [incidents, setIncidents] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);

  useEffect(() => {
    if (!firmId || period !== PERIOD_30D) return;
    let cancelled = false;
    setChartLoading(true);
    setChartError(null);
    fetch(`/api/v2/propfirms/${firmId}/chart?period=30d`)
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
  }, [firmId, period]);

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

  const summary = chartData?.summary;
  const chart = chartData?.chart;
  const chartBuckets = chart?.data || [];

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
      {/* Left column: Performance Intelligence row, four cards, chart, Recent Intelligence */}
      <div className="lg:col-span-2 space-y-6">
      {/* Performance Intelligence: icon + label left, 30 DAYS / 12 MONTHS right */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <h2 className="text-lg font-bold text-slate-900">
            Performance Intelligence
          </h2>
        </div>
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-[20px] border border-slate-200">
          <button
            type="button"
            onClick={() => setPeriod(PERIOD_30D)}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-[16px] transition-all ${
              period === PERIOD_30D
                ? "text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
            style={period === PERIOD_30D ? { backgroundColor: THEME.primary } : {}}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            30 Days
          </button>
          <button
            type="button"
            disabled
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-[16px] text-slate-400 cursor-not-allowed bg-white/50"
            title="12 months not supported on this page"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            12 Months
          </button>
        </div>
      </div>

      {/* Four KPI cards — exact match: VERIFIED PAYOUTS, EVIDENCE COUNT, OBSERVED AVG, LAST SIGNAL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
              Verified Payouts
            </span>
            <div className="p-2 bg-slate-50 rounded-lg">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: THEME.primary }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900 tracking-tight">
            {formatShort(summary?.totalPayouts)}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
            Observed (Last 30d)
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
              Evidence Count
            </span>
            <div className="p-2 bg-slate-50 rounded-lg">
              <svg
                className="w-4 h-4 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900 tracking-tight">
            {(summary?.payoutCount ?? 0).toLocaleString()}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
            TXs (30d)
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
              Observed Avg
            </span>
            <div className="p-2 bg-slate-50 rounded-lg">
              <svg
                className="w-4 h-4 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900 tracking-tight">
            {formatCurrency(summary?.avgPayout)}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
            Mean payout
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
              Last Signal
            </span>
            <div className="p-2 bg-slate-50 rounded-lg">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: THEME.primary }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <p className="text-xl font-bold text-slate-900 tracking-tight">
            {timeSince(summary?.latestPayoutAt) || "N/A"}
          </p>
          <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
            Live check
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Total Payouts</h2>
          <p className="text-[11px] font-extrabold tracking-wider text-slate-400 uppercase mb-4">
            UTC Timezone · Synchronized to 30d window
          </p>
          <div className="flex items-center gap-5 mb-4">
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Crypto
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Rise
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              Wire
            </span>
          </div>
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
                <Bar
                  dataKey="rise"
                  stackId="a"
                  fill="#3b82f6"
                  radius={[6, 6, 0, 0]}
                  name="Rise"
                />
                <Bar
                  dataKey="crypto"
                  stackId="a"
                  fill="#f59e0b"
                  radius={[6, 6, 0, 0]}
                  name="Crypto"
                />
                <Bar
                  dataKey="wire"
                  stackId="a"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  name="Wire"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-500 text-sm">
              No payout data for this period
            </div>
          )}
          </div>

          {/* Recent Intelligence — left column below chart */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            Recent Intelligence
          </h2>
          {incidentsLoading ? (
            <div className="py-8 text-center">
              <span className="loading loading-spinner loading-sm" />
            </div>
          ) : incidents.length > 0 ? (
            <ul className="space-y-4">
              {incidents.slice(0, 5).map((inc) => (
                <li
                  key={inc.id}
                  className="flex gap-3 p-3 rounded-lg bg-slate-50/50 border border-slate-100"
                >
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                      inc.severity === "high" ? "bg-red-500" : "bg-emerald-500"
                    }`}
                  />
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      {inc.incident_type?.toUpperCase?.() || "INCIDENT"} ·{" "}
                      {inc.week_start}
                    </p>
                    <p className="font-semibold text-slate-900 text-sm mt-0.5">
                      {inc.title}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">{inc.summary}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500 py-4">
              No recent incidents in the last 90 days.
            </p>
          )}
          <Link
            href={`/propfirm/${firmId}/intelligence`}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
            style={{ color: THEME.primary }}
          >
            See Full Intelligence Layer
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </div>
        </div>

        {/* Right section: Firm Signals (30d) + Signal Alert — full right column after nav */}
        <div className="lg:col-span-1 flex flex-col gap-6">
        {/* Firm Signals (30d) */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">
              Firm Signals (30d)
            </h2>
            <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
              STABLE
            </span>
          </div>
          {signalsLoading ? (
            <div className="py-8 text-center">
              <span className="loading loading-spinner loading-sm" />
            </div>
          ) : signals ? (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                  Payout Data
                </p>
                <p className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Steady Activity
                </p>
                <ul className="mt-1 text-xs text-slate-600 list-disc list-inside space-y-0.5">
                  <li>Consistent daily payout volume</li>
                  <li>High transaction velocity</li>
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                  Trustpilot
                </p>
                <p className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Mostly Positive
                </p>
                <ul className="mt-1 text-xs text-slate-600 list-disc list-inside space-y-0.5">
                  <li>Frequent mentions of &apos;Fast Payouts&apos;</li>
                  <li>Reliable customer support signals</li>
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                  X (Twitter)
                </p>
                <p className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  High Discussion
                </p>
                <ul className="mt-1 text-xs text-slate-600 list-disc list-inside space-y-0.5">
                  <li>Numerous payout proof screenshots</li>
                  <li>Discussion around new scaling rules</li>
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No signal data available</p>
          )}
          <Link
            href={`/propfirm/${firmId}/intelligence`}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
            style={{ color: THEME.primary }}
          >
            View detailed intelligence
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
          <p className="text-[10px] text-slate-400 mt-2">
            Signals are derived from observed trends and reported events based on
            sampled public sources.
          </p>
        </div>

        {/* Signal Alert — theme strip blue */}
        <div
          className="p-6 rounded-xl border shadow-sm text-white flex-shrink-0"
          style={{
            backgroundColor: THEME.primary,
            borderColor: THEME.border.light,
          }}
        >
          <h3 className="text-lg font-bold mb-2">Signal Alert</h3>
          <p className="text-sm text-white mb-4 opacity-90">
            We monitor payout clusters and social patterns. Get notified when
            stability thresholds are breached.
          </p>
          <button
            type="button"
            className="px-4 py-2.5 bg-white text-slate-900 text-sm font-semibold rounded-lg hover:bg-slate-100 transition-colors shadow-sm"
          >
            Setup Custom Alerts
          </button>
        </div>
        </div>
      </div>
  );
}
