"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/**
 * TICKET-014: Settings section to manage which firms the user follows for the weekly digest.
 * One aggregated email per week with all followed firms.
 */
export default function SubscriptionSettings() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unfollowingId, setUnfollowingId] = useState(null);
  const [unfollowAllLoading, setUnfollowAllLoading] = useState(false);

  async function fetchSubscriptions() {
    try {
      const res = await fetch("/api/subscriptions");
      if (res.status === 401) {
        setSubscriptions([]);
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setSubscriptions(data.subscriptions || []);
    } catch (err) {
      console.error("[SubscriptionSettings] fetch", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  async function handleUnfollow(firmId) {
    setUnfollowingId(firmId);
    try {
      const res = await fetch(`/api/subscriptions/${firmId}`, { method: "DELETE" });
      if (res.ok) {
        setSubscriptions((prev) => prev.filter((s) => s.firm_id !== firmId));
      }
    } catch (err) {
      console.error("[SubscriptionSettings] unfollow", err);
    } finally {
      setUnfollowingId(null);
    }
  }

  async function handleUnfollowAll() {
    if (subscriptions.length === 0) return;
    if (!confirm("Unfollow all firms? You will stop receiving the weekly digest until you follow firms again.")) {
      return;
    }
    setUnfollowAllLoading(true);
    try {
      await Promise.all(
        subscriptions.map((s) =>
          fetch(`/api/subscriptions/${s.firm_id}`, { method: "DELETE" })
        )
      );
      setSubscriptions([]);
    } catch (err) {
      console.error("[SubscriptionSettings] unfollow all", err);
    } finally {
      setUnfollowAllLoading(false);
    }
  }

  // Try .webp first (the5ers, fundingpips), then .png, .jpeg (files in public/logos/firms/)
  function getLogoUrl(sub) {
    return `/logos/firms/${sub.firm_id}.webp`;
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5 text-gray-600"
          >
            <path d="M3.25 4A2.25 2.25 0 001 6.25v7.5A2.25 2.25 0 003.25 16h7.5A2.25 2.25 0 0013 13.75v-7.5A2.25 2.25 0 0010.75 4h-7.5zM19 4.75a.75.75 0 00-1.28-.53l-3 3a.75.75 0 00-.22.53v4.5c0 .199.079.39.22.53l3 3a.75.75 0 001.28-.53V4.75z" />
          </svg>
          <h2 className="text-xl font-bold">Weekly Digest</h2>
        </div>
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-md"></span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-5 h-5 text-gray-600"
        >
          <path d="M3.25 4A2.25 2.25 0 001 6.25v7.5A2.25 2.25 0 003.25 16h7.5A2.25 2.25 0 0013 13.75v-7.5A2.25 2.25 0 0010.75 4h-7.5zM19 4.75a.75.75 0 00-1.28-.53l-3 3a.75.75 0 00-.22.53v4.5c0 .199.079.39.22.53l3 3a.75.75 0 001.28-.53V4.75z" />
        </svg>
        <h2 className="text-xl font-bold">Weekly Digest</h2>
      </div>

      <p className="text-gray-600 mb-6">
        You receive one aggregated email per week with reports for all firms you follow.
      </p>

      {subscriptions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">
            You&apos;re not following any firms yet. You&apos;ll get one weekly digest with all firms you follow.
          </p>
          <Link
            href="/propfirms"
            className="text-purple-600 hover:text-purple-700 font-medium underline"
          >
            Browse firms
          </Link>
        </div>
      ) : (
        <>
          <ul className="space-y-3 mb-6">
            {subscriptions.map((sub) => (
              <li
                key={sub.id}
                className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={getLogoUrl(sub)}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover bg-white shrink-0"
                    onError={(e) => {
                      const next = e.target.src?.includes(".webp")
                        ? `/logos/firms/${sub.firm_id}.png`
                        : `/logos/firms/${sub.firm_id}.jpeg`;
                      e.target.src = next;
                      e.target.onerror = () => {
                        e.target.style.display = "none";
                      };
                    }}
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-gray-900 truncate">
                      {sub.firm?.name || sub.firm_id}
                    </p>
                    <p className="text-xs text-gray-500">
                      Following since {new Date(sub.subscribed_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnfollow(sub.firm_id)}
                  disabled={unfollowingId === sub.firm_id}
                  className="text-xs text-red-600 hover:text-red-700 font-semibold shrink-0 ml-4 disabled:opacity-50"
                >
                  {unfollowingId === sub.firm_id ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    "Unfollow"
                  )}
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={handleUnfollowAll}
            disabled={unfollowAllLoading}
            className="text-sm text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
          >
            {unfollowAllLoading ? (
              <span className="inline-flex items-center gap-2">
                <span className="loading loading-spinner loading-xs"></span>
                Unfollowing…
              </span>
            ) : (
              "Unfollow all"
            )}
          </button>
        </>
      )}
    </div>
  );
}
