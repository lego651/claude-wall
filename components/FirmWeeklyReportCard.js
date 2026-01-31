"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * TICKET-013: Card on firm detail page to follow/unfollow for weekly digest.
 * One aggregated email per week with all firms the user follows.
 */
export default function FirmWeeklyReportCard({ firmId }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  /** Next Monday 00:00 UTC as "Monday, Feb 3" */
  function getNextDigestLabel() {
    const now = new Date();
    const day = now.getUTCDay();
    const daysToAdd = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
    const next = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + daysToAdd,
        0,
        0,
        0,
        0
      )
    );
    return next.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  useEffect(() => {
    async function checkSubscription() {
      try {
        const res = await fetch("/api/subscriptions");
        if (res.status === 401) {
          setUser(null);
          setSubscribed(false);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setUser(true);
        const follows = (data.subscriptions || []).some(
          (s) => s.firm_id === firmId
        );
        setSubscribed(follows);
      } catch (err) {
        console.error("[FirmWeeklyReportCard] checkSubscription", err);
      } finally {
        setLoading(false);
      }
    }
    if (firmId) checkSubscription();
  }, [firmId]);

  async function handleFollow() {
    if (!user) {
      router.push("/signin");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firm_id: firmId }),
      });
      if (res.ok) setSubscribed(true);
    } catch (err) {
      console.error("[FirmWeeklyReportCard] follow", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnfollow() {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/subscriptions/${firmId}`, {
        method: "DELETE",
      });
      if (res.ok) setSubscribed(false);
    } catch (err) {
      console.error("[FirmWeeklyReportCard] unfollow", err);
    } finally {
      setActionLoading(false);
    }
  }

  const nextDigestLabel = getNextDigestLabel();

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-6 rounded-2xl border border-purple-100 shadow-sm mb-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">
            Get Weekly Intelligence Reports
          </h3>
          <p className="text-sm text-slate-600">
            One weekly digest email with payouts and community sentiment for the
            firms you follow (every Monday).
          </p>
        </div>
        {!loading && subscribed && (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full shrink-0">
            <span aria-hidden>✓</span> Following
          </span>
        )}
      </div>

      <ul className="space-y-3 mb-5 text-sm text-slate-700">
        <li className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-purple-600 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Blockchain-verified payout summary
        </li>
        <li className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-purple-600 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
            />
          </svg>
          Trustpilot sentiment analysis
        </li>
        <li className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-purple-600 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          Incident alerts and red flags
        </li>
        <li className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-purple-600 shrink-0"
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
          Trust score updates
        </li>
      </ul>

      {loading ? (
        <div className="h-12 rounded-xl bg-slate-200/60 animate-pulse" />
      ) : user ? (
        <button
          type="button"
          onClick={subscribed ? handleUnfollow : handleFollow}
          disabled={actionLoading}
          className={`w-full py-3 rounded-xl font-bold transition-all ${
            subscribed
              ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
              : "bg-purple-600 text-white hover:bg-purple-700"
          } disabled:opacity-70 disabled:cursor-not-allowed`}
        >
          {actionLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="loading loading-spinner loading-sm" />
              {subscribed ? "Unfollowing…" : "Following…"}
            </span>
          ) : subscribed ? (
            "Following ✓"
          ) : (
            "Follow (Free)"
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => router.push("/signin")}
          className="w-full py-3 rounded-xl font-bold bg-purple-600 text-white hover:bg-purple-700 transition-all"
        >
          Sign In to Follow
        </button>
      )}

      <p className="text-xs text-slate-500 text-center mt-3">
        Next digest: {nextDigestLabel}
      </p>
    </div>
  );
}
