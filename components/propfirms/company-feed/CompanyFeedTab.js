"use client";

import { useState, useEffect } from "react";
import TimelineItem from "./TimelineItem";

const TABS = [
  { key: "updates", label: "Updates" },
  { key: "promotions", label: "Promotions" },
];

const PROMOTION_TYPE = "promotion";

function isUpdateItem(item) {
  return item.content_type !== PROMOTION_TYPE;
}

function isPromotionItem(item) {
  return item.content_type === PROMOTION_TYPE;
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading company feed">
      {[1, 2, 3].map((i) => (
        <div key={i} className="relative flex gap-4">
          <div className="shrink-0 w-4 flex justify-center pt-3.5">
            <span className="block w-2.5 h-2.5 rounded-full bg-slate-200 animate-pulse" />
          </div>
          <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-4 w-20 bg-slate-200 rounded" />
              <div className="h-4 w-48 bg-slate-200 rounded" />
            </div>
            <div className="h-3 w-full bg-slate-100 rounded mb-1.5" />
            <div className="h-3 w-3/4 bg-slate-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Company Feed section for the intelligence page.
 * Shows firm-originated content (news, rule changes, promotions) in two tabs.
 *
 * @param {{ firmId: string }} props
 */
export default function CompanyFeedTab({ firmId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("updates");

  useEffect(() => {
    if (!firmId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetch(`/api/v2/propfirms/${firmId}/content`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load"))))
      .then((data) => {
        if (!cancelled) setItems(data.items || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [firmId]);

  const visibleItems = items.filter(
    activeTab === "updates" ? isUpdateItem : isPromotionItem
  );

  return (
    <section aria-label="Company Feed">
      {/* Section header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Company Feed</h2>
          <p className="text-slate-500 text-sm mt-1">
            Official updates, rule changes, and promotions directly from this firm.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                activeTab === tab.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed content */}
      {loading ? (
        <FeedSkeleton />
      ) : error ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-400 text-sm">Unable to load company feed.</p>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-500 text-sm">
            {activeTab === "updates"
              ? "No updates from this firm yet."
              : "No promotions from this firm yet."}
          </p>
        </div>
      ) : (
        <div className="relative flex flex-col gap-4">
          <div
            className="absolute left-[7px] top-3 bottom-3 w-0.5 bg-slate-200"
            aria-hidden
          />
          {visibleItems.map((item) => (
            <TimelineItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
