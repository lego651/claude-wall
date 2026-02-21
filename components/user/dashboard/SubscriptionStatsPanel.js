"use client";

import Link from "next/link";

/**
 * S7-009: Dashboard panel showing subscription stats (firms subscribed, next digest date).
 */
export default function SubscriptionStatsPanel({ stats, loading }) {
  if (loading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-slate-100 rounded w-2/3" />
          <div className="h-8 bg-slate-100 rounded w-1/3" />
          <div className="h-4 bg-slate-100 rounded w-full" />
          <div className="h-9 bg-slate-100 rounded w-1/2 mt-4" />
        </div>
      </div>
    );
  }

  const subscribedCount = stats?.subscribedCount ?? 0;
  const nextDigestDate = stats?.nextDigestDate
    ? new Date(stats.nextDigestDate).toLocaleString("en-US", {
        weekday: "long",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
      <h3 className="text-lg font-bold text-slate-900 mb-1">Weekly Digest</h3>
      <p className="text-xs text-slate-500 mb-4">Prop firm news and updates</p>
      <div className="flex items-center gap-4 mb-4">
        <div
          className="text-2xl font-bold tabular-nums"
          style={{ color: "#635BFF" }}
        >
          {subscribedCount}
        </div>
        <div className="text-sm text-slate-600">Firms subscribed</div>
      </div>
      {nextDigestDate && (
        <p className="text-xs text-slate-500 mb-4">
          Next digest: {nextDigestDate}
        </p>
      )}
      <Link
        href="/user/subscriptions"
        className="inline-flex items-center gap-2 text-sm font-semibold hover:underline"
        style={{ color: "#635BFF" }}
      >
        Manage subscriptions
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
  );
}
