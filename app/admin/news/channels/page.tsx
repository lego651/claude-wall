/**
 * Admin: YouTube Channel & Keyword Management
 * /admin/news/channels
 *
 * Manage the YouTube channel watchlist and keyword search list
 * that power the daily /news page picks.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminLayout from "@/components/common/AdminLayout";

interface Channel {
  id: string;
  channel_id: string;
  channel_name: string;
  category: string;
  upload_playlist_id: string | null;
  active: boolean;
}

interface Keyword {
  id: string;
  keyword: string;
  active: boolean;
}

interface LookupResult {
  channel_id: string;
  channel_name: string;
  description: string;
  thumbnail: string;
  subscriber_count: number;
  suggested_category: string;
}

function formatSubscribers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

const CATEGORIES = [
  "prop_firm_official",
  "trading_educator",
  "prop_firm_review",
  "industry_news",
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  prop_firm_official: "Prop Firm Official",
  trading_educator: "Trading Educator",
  prop_firm_review: "Prop Firm Review",
  industry_news: "Industry News",
};

const CATEGORY_COLORS: Record<string, string> = {
  prop_firm_official: "badge-primary",
  trading_educator: "badge-secondary",
  prop_firm_review: "badge-accent",
  industry_news: "badge-neutral",
};

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={`badge badge-sm ${CATEGORY_COLORS[category] ?? "badge-ghost"}`}>
      {CATEGORY_LABELS[category] ?? category}
    </span>
  );
}

export default function ChannelManagementPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  // Add channel — lookup flow
  const [lookupUrl, setLookupUrl] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [newChannelId, setNewChannelId] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelCategory, setNewChannelCategory] = useState<string>(CATEGORIES[0]);
  const [addingChannel, setAddingChannel] = useState(false);
  const [addChannelError, setAddChannelError] = useState<string | null>(null);

  // Add keyword form
  const [newKeyword, setNewKeyword] = useState("");
  const [addingKeyword, setAddingKeyword] = useState(false);
  const [addKeywordError, setAddKeywordError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [chRes, kwRes] = await Promise.all([
        fetch("/api/admin/youtube/channels"),
        fetch("/api/admin/youtube/keywords"),
      ]);
      if (!chRes.ok || !kwRes.ok) throw new Error("Failed to fetch data");
      const [chData, kwData] = await Promise.all([chRes.json(), kwRes.json()]);
      setChannels(chData.channels ?? []);
      setKeywords(kwData.keywords ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function toggleChannel(id: string, active: boolean) {
    setChannels((prev) => prev.map((ch) => (ch.id === id ? { ...ch, active } : ch)));
    await fetch(`/api/admin/youtube/channels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
  }

  async function deleteChannel(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setChannels((prev) => prev.filter((ch) => ch.id !== id));
    await fetch(`/api/admin/youtube/channels/${id}`, { method: "DELETE" });
  }

  async function toggleKeyword(id: string, active: boolean) {
    setKeywords((prev) => prev.map((kw) => (kw.id === id ? { ...kw, active } : kw)));
    await fetch(`/api/admin/youtube/keywords/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
  }

  async function deleteKeyword(id: string, keyword: string) {
    if (!confirm(`Delete keyword "${keyword}"?`)) return;
    setKeywords((prev) => prev.filter((kw) => kw.id !== id));
    await fetch(`/api/admin/youtube/keywords/${id}`, { method: "DELETE" });
  }

  async function lookupChannel(e: React.FormEvent) {
    e.preventDefault();
    setLookupLoading(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const res = await fetch(
        `/api/admin/youtube/lookup?url=${encodeURIComponent(lookupUrl.trim())}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed");
      setLookupResult(data);
      setNewChannelId(data.channel_id);
      setNewChannelName(data.channel_name);
      setNewChannelCategory(data.suggested_category ?? CATEGORIES[0]);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLookupLoading(false);
    }
  }

  async function addChannel(e: React.FormEvent) {
    e.preventDefault();
    setAddingChannel(true);
    setAddChannelError(null);
    try {
      const res = await fetch("/api/admin/youtube/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel_id: newChannelId.trim(),
          channel_name: newChannelName.trim(),
          category: newChannelCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add channel");
      setLookupUrl("");
      setLookupResult(null);
      setNewChannelId("");
      setNewChannelName("");
      setNewChannelCategory(CATEGORIES[0]);
      await fetchData();
    } catch (err) {
      setAddChannelError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAddingChannel(false);
    }
  }

  async function addKeyword(e: React.FormEvent) {
    e.preventDefault();
    setAddingKeyword(true);
    setAddKeywordError(null);
    try {
      const res = await fetch("/api/admin/youtube/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: newKeyword.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add keyword");
      setNewKeyword("");
      await fetchData();
    } catch (err) {
      setAddKeywordError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAddingKeyword(false);
    }
  }

  async function restoreDefaults() {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const res = await fetch("/api/admin/youtube/seed", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to restore defaults");
      }
      setSeedMsg("Defaults restored");
      await fetchData();
    } catch (err) {
      setSeedMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setSeeding(false);
      setTimeout(() => setSeedMsg(null), 3000);
    }
  }

  const activeChannels = channels.filter((c) => c.active).length;
  const activeKeywords = keywords.filter((k) => k.active).length;

  // Channels to show based on category filter
  const visibleChannels =
    selectedCategory === "all"
      ? channels
      : channels.filter((c) => c.category === selectedCategory);

  // Sections: grouped by category when showing all, single section when filtered
  const sections =
    selectedCategory === "all"
      ? CATEGORIES.map((cat) => ({
          category: cat as string,
          items: visibleChannels.filter((c) => c.category === cat),
        }))
      : [{ category: null, items: visibleChannels }];

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto py-10 px-4 space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/admin"
                className="text-sm text-base-content/40 hover:text-primary transition-colors"
              >
                Admin
              </Link>
              <span className="text-base-content/30">/</span>
              <span className="text-sm font-semibold">YouTube Channels</span>
            </div>
            <h1 className="text-2xl font-black">News Feed Sources</h1>
            <p className="text-sm text-base-content/50 mt-1">
              {activeChannels} active channels · {activeKeywords} active keywords
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="btn btn-sm btn-ghost gap-1"
              onClick={restoreDefaults}
              disabled={seeding}
              title="Re-add any missing default channels and keywords"
            >
              {seeding ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <span>↺</span>
              )}
              Restore Defaults
            </button>
            {seedMsg && (
              <span className="text-xs text-success">{seedMsg}</span>
            )}
            <Link href="/admin/news/debug" className="btn btn-sm btn-outline">
              Debug Top-15
            </Link>
            <Link href="/news" target="_blank" className="btn btn-sm btn-outline gap-1">
              View /news
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </Link>
          </div>
        </div>

        {error && <div className="alert alert-error text-sm">{error}</div>}

        {/* Channels Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-black">YouTube Channels</h2>

          {/* Add channel — URL lookup */}
          <div className="card bg-base-100 border border-base-200 p-5 space-y-4">
            <h3 className="font-bold text-sm">Add Channel</h3>

            {/* Step 1: paste URL */}
            <form onSubmit={lookupChannel} className="flex gap-2">
              <input
                className="input input-sm input-bordered flex-1 font-mono text-xs"
                placeholder="https://www.youtube.com/@channelname"
                value={lookupUrl}
                onChange={(e) => {
                  setLookupUrl(e.target.value);
                  if (lookupResult) setLookupResult(null);
                }}
                required
              />
              <button
                type="submit"
                className="btn btn-sm btn-outline"
                disabled={lookupLoading}
              >
                {lookupLoading ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  "Lookup"
                )}
              </button>
            </form>

            {lookupError && (
              <p className="text-error text-xs">{lookupError}</p>
            )}

            {/* Step 2: preview + confirm */}
            {lookupResult && (
              <form onSubmit={addChannel} className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-base-200/50 border border-base-200">
                  {lookupResult.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={lookupResult.thumbnail}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        className="input input-xs input-bordered font-semibold flex-1 min-w-0"
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value)}
                        required
                      />
                      {lookupResult.subscriber_count > 0 && (
                        <span className="text-xs text-base-content/40 shrink-0">
                          {formatSubscribers(lookupResult.subscriber_count)} subs
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-xs text-base-content/40">{newChannelId}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-base-content/50">Category:</span>
                      <select
                        className="select select-xs select-bordered"
                        value={newChannelCategory}
                        onChange={(e) => setNewChannelCategory(e.target.value)}
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {CATEGORY_LABELS[cat]}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-base-content/30 italic">auto-suggested</span>
                    </div>
                  </div>
                </div>

                {addChannelError && (
                  <p className="text-error text-xs">{addChannelError}</p>
                )}

                <div className="flex gap-2">
                  <button type="submit" className="btn btn-sm btn-primary" disabled={addingChannel}>
                    {addingChannel ? "Adding..." : "Add Channel"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setLookupResult(null);
                      setLookupUrl("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Category filter tabs */}
          <div className="flex gap-1 flex-wrap">
            <button
              className={`btn btn-xs ${selectedCategory === "all" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setSelectedCategory("all")}
            >
              All ({channels.length})
            </button>
            {CATEGORIES.map((cat) => {
              const count = channels.filter((c) => c.category === cat).length;
              const shortLabel = CATEGORY_LABELS[cat].split(" ")[0];
              return (
                <button
                  key={cat}
                  className={`btn btn-xs ${selectedCategory === cat ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {shortLabel} ({count})
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <span className="loading loading-spinner loading-md" />
            </div>
          ) : (
            <div className="space-y-5">
              {sections.map(({ category, items }) => {
                const activeCount = items.filter((c) => c.active).length;
                return (
                  <div key={category ?? "filtered"}>
                    {category && (
                      <div className="flex items-center gap-2 mb-2">
                        <CategoryBadge category={category} />
                        <span className="text-xs text-base-content/40">
                          {activeCount}/{items.length} active
                        </span>
                      </div>
                    )}
                    <div className="overflow-x-auto rounded-2xl border border-base-200">
                      <table className="table table-sm">
                        <thead>
                          <tr className="bg-base-200/50">
                            <th>Channel</th>
                            <th>ID</th>
                            {!category && <th>Category</th>}
                            <th>Playlist</th>
                            <th>Active</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.length === 0 ? (
                            <tr>
                              <td
                                colSpan={category ? 5 : 6}
                                className="text-center text-base-content/30 py-6"
                              >
                                No channels in this category
                              </td>
                            </tr>
                          ) : (
                            items.map((ch) => (
                              <tr key={ch.id} className={!ch.active ? "opacity-40" : ""}>
                                <td className="font-semibold">
                                  <a
                                    href={`https://www.youtube.com/channel/${ch.channel_id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-primary transition-colors"
                                  >
                                    {ch.channel_name}
                                  </a>
                                </td>
                                <td className="font-mono text-xs text-base-content/40">
                                  {ch.channel_id}
                                </td>
                                {!category && (
                                  <td>
                                    <CategoryBadge category={ch.category} />
                                  </td>
                                )}
                                <td>
                                  {ch.upload_playlist_id ? (
                                    <span className="text-success text-xs font-semibold">
                                      Cached
                                    </span>
                                  ) : (
                                    <span className="text-warning text-xs">Pending</span>
                                  )}
                                </td>
                                <td>
                                  <input
                                    type="checkbox"
                                    className="toggle toggle-sm toggle-primary"
                                    checked={ch.active}
                                    onChange={(e) => toggleChannel(ch.id, e.target.checked)}
                                  />
                                </td>
                                <td>
                                  <button
                                    className="btn btn-ghost btn-xs text-base-content/30 hover:text-error hover:bg-error/10"
                                    onClick={() => deleteChannel(ch.id, ch.channel_name)}
                                    title="Delete channel"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </section>

        {/* Keywords Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-black">Search Keywords</h2>

          {/* Keywords as chips */}
          {!loading && (
            <div className="card bg-base-100 border border-base-200 p-4 space-y-3">
              {keywords.length === 0 ? (
                <p className="text-sm text-base-content/30">No keywords yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {keywords.map((kw) => (
                    <div
                      key={kw.id}
                      className={`badge gap-1 cursor-pointer select-none transition-opacity pr-1 ${
                        kw.active ? "badge-primary" : "badge-ghost opacity-50"
                      }`}
                      onClick={() => toggleKeyword(kw.id, !kw.active)}
                    >
                      {kw.keyword}
                      <button
                        className="ml-1 opacity-50 hover:opacity-100 hover:text-error"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteKeyword(kw.id, kw.keyword);
                        }}
                        title="Delete keyword"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-base-content/30">
                Click to toggle active · ✕ to delete
              </p>
            </div>
          )}

          {/* Add keyword form */}
          <form
            onSubmit={addKeyword}
            className="card bg-base-100 border border-base-200 p-5 space-y-3"
          >
            <h3 className="font-bold text-sm">Add Keyword</h3>
            <div className="flex gap-3">
              <input
                className="input input-sm input-bordered flex-1"
                placeholder='e.g. "funded trader tips"'
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                required
              />
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                disabled={addingKeyword}
              >
                {addingKeyword ? "Adding..." : "Add"}
              </button>
            </div>
            {addKeywordError && (
              <p className="text-error text-xs">{addKeywordError}</p>
            )}
          </form>
        </section>
      </div>
    </AdminLayout>
  );
}
