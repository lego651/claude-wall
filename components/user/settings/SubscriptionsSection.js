"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { getFirmLogoUrl, DEFAULT_LOGO_URL } from "@/lib/logoUtils";

/**
 * Subscriptions settings section: list all firms with search, tabs (all / subscribed / unsubscribed),
 * and toggle to follow/unfollow for weekly digest.
 */
export default function SubscriptionsSection() {
  const [firms, setFirms] = useState([]);
  const [subscribedIds, setSubscribedIds] = useState(new Set());
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [propRes, subRes] = await Promise.all([
          fetch("/api/v2/propfirms?period=1d"),
          fetch("/api/subscriptions"),
        ]);

        const propData = propRes.ok ? await propRes.json() : { data: [] };
        const list = Array.isArray(propData.data) ? propData.data : [];

        let ids = new Set();
        if (subRes.ok) {
          const subData = await subRes.json();
          const subs = subData.subscriptions || [];
          subs.forEach((s) => ids.add(s.firm_id));
        }

        setFirms(list);
        setSubscribedIds(ids);
      } catch (err) {
        console.error("[SubscriptionsSection]", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const firmsWithSubscribed = useMemo(() => {
    return firms.map((f) => ({
      ...f,
      subscribed: subscribedIds.has(f.id),
    }));
  }, [firms, subscribedIds]);

  const filteredFirms = useMemo(() => {
    return firmsWithSubscribed.filter((firm) => {
      const matchesSearch = firm.name.toLowerCase().includes(search.toLowerCase());
      const matchesTab =
        activeTab === "all"
          ? true
          : activeTab === "subscribed"
            ? firm.subscribed
            : !firm.subscribed;
      return matchesSearch && matchesTab;
    });
  }, [firmsWithSubscribed, search, activeTab]);

  const subscribedCount = firmsWithSubscribed.filter((f) => f.subscribed).length;

  async function handleToggleSubscription(firmId) {
    setTogglingId(firmId);
    const isSubscribed = subscribedIds.has(firmId);
    try {
      if (isSubscribed) {
        const res = await fetch(`/api/subscriptions/${firmId}`, { method: "DELETE" });
        if (res.ok) {
          setSubscribedIds((prev) => {
            const next = new Set(prev);
            next.delete(firmId);
            return next;
          });
        }
      } else {
        const res = await fetch("/api/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firm_id: firmId }),
        });
        if (res.ok) {
          setSubscribedIds((prev) => new Set([...prev, firmId]));
        }
      }
    } catch (err) {
      console.error("[SubscriptionsSection] toggle", err);
    } finally {
      setTogglingId(null);
    }
  }

  function getLogoUrl(firm) {
    return getFirmLogoUrl({
      firm_id: firm.id,
      logo_url: firm.logo ?? firm.logo_url,
    });
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Firm Newsletters</h3>
          <p className="text-sm text-slate-500">
            Follow prop firms to receive weekly digests of news and updates.
          </p>
        </div>
        <div className="bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-bold border border-emerald-100">
          {subscribedCount} Subscribed
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-grow">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search firms..."
            className="input input-bordered w-full pl-10 rounded-xl text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {["all", "subscribed", "unsubscribed"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                activeTab === tab
                  ? "bg-white text-primary shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredFirms.length > 0 ? (
          filteredFirms.map((firm) => (
            <div
              key={firm.id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                firm.subscribed
                  ? "border-primary/20 bg-primary/5"
                  : "border-slate-100 bg-slate-50/50"
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 bg-white rounded-lg p-1 border border-slate-100 shadow-sm flex items-center justify-center shrink-0">
                  <img
                    src={getLogoUrl(firm)}
                    alt=""
                    className="w-10 h-10 object-contain rounded"
                    onError={(e) => {
                      e.target.src = DEFAULT_LOGO_URL;
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-slate-900 truncate">{firm.name}</h4>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                    Prop Firm
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleSubscription(firm.id)}
                disabled={togglingId === firm.id}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 ${
                  firm.subscribed ? "bg-primary" : "bg-slate-200"
                }`}
                aria-label={firm.subscribed ? "Unsubscribe" : "Subscribe"}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    firm.subscribed ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-slate-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h4 className="text-slate-900 font-bold">No firms found</h4>
            <p className="text-sm text-slate-500">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>

      <div className="mt-8 pt-8 border-t border-slate-100 flex items-center gap-3 text-xs text-slate-400">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>
          Showing {filteredFirms.length} of {firms.length} available prop firms. New firms are
          added weekly.
        </span>
      </div>
    </div>
  );
}
