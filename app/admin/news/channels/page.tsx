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

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    prop_firm_official: "badge-primary",
    trading_educator: "badge-secondary",
    prop_firm_review: "badge-accent",
    industry_news: "badge-neutral",
  };
  return (
    <span className={`badge badge-sm ${colors[category] ?? "badge-ghost"}`}>
      {CATEGORY_LABELS[category] ?? category}
    </span>
  );
}

export default function ChannelManagementPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add channel form state
  const [newChannelId, setNewChannelId] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelCategory, setNewChannelCategory] = useState<string>(CATEGORIES[0]);
  const [addingChannel, setAddingChannel] = useState(false);
  const [addChannelError, setAddChannelError] = useState<string | null>(null);

  // Add keyword form state
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
    setChannels((prev) =>
      prev.map((ch) => (ch.id === id ? { ...ch, active } : ch))
    );
    await fetch(`/api/admin/youtube/channels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
  }

  async function toggleKeyword(id: string, active: boolean) {
    setKeywords((prev) =>
      prev.map((kw) => (kw.id === id ? { ...kw, active } : kw))
    );
    await fetch(`/api/admin/youtube/keywords/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
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

  const activeChannels = channels.filter((c) => c.active).length;
  const activeKeywords = keywords.filter((k) => k.active).length;

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto py-10 px-4 space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin" className="text-sm text-base-content/40 hover:text-primary transition-colors">
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
          <Link href="/news" target="_blank" className="btn btn-sm btn-outline gap-2">
            View /news page
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </Link>
        </div>

        {error && (
          <div className="alert alert-error text-sm">{error}</div>
        )}

        {/* Channels Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-black">YouTube Channels</h2>

          {/* Add channel form */}
          <form onSubmit={addChannel} className="card bg-base-100 border border-base-200 p-5 space-y-3">
            <h3 className="font-bold text-sm">Add Channel</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                className="input input-sm input-bordered"
                placeholder="Channel ID (UCxxxxxxxx)"
                value={newChannelId}
                onChange={(e) => setNewChannelId(e.target.value)}
                required
              />
              <input
                className="input input-sm input-bordered"
                placeholder="Channel name"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                required
              />
              <select
                className="select select-sm select-bordered"
                value={newChannelCategory}
                onChange={(e) => setNewChannelCategory(e.target.value)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                ))}
              </select>
            </div>
            {addChannelError && (
              <p className="text-error text-xs">{addChannelError}</p>
            )}
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={addingChannel}
            >
              {addingChannel ? "Adding..." : "Add Channel"}
            </button>
          </form>

          {/* Channel table */}
          {loading ? (
            <div className="flex justify-center py-10">
              <span className="loading loading-spinner loading-md" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-base-200">
              <table className="table table-sm">
                <thead>
                  <tr className="bg-base-200/50">
                    <th>Channel</th>
                    <th>ID</th>
                    <th>Category</th>
                    <th>Playlist cached</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-base-content/30 py-8">
                        No channels yet
                      </td>
                    </tr>
                  ) : (
                    channels.map((ch) => (
                      <tr key={ch.id} className={!ch.active ? "opacity-40" : ""}>
                        <td className="font-semibold">{ch.channel_name}</td>
                        <td className="font-mono text-xs text-base-content/50">{ch.channel_id}</td>
                        <td><CategoryBadge category={ch.category} /></td>
                        <td>
                          {ch.upload_playlist_id ? (
                            <span className="text-success text-xs font-semibold">Yes</span>
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Keywords Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-black">Search Keywords</h2>

          {/* Add keyword form */}
          <form onSubmit={addKeyword} className="card bg-base-100 border border-base-200 p-5 space-y-3">
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

          {/* Keywords list */}
          {!loading && (
            <div className="overflow-x-auto rounded-2xl border border-base-200">
              <table className="table table-sm">
                <thead>
                  <tr className="bg-base-200/50">
                    <th>Keyword</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {keywords.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="text-center text-base-content/30 py-8">
                        No keywords yet
                      </td>
                    </tr>
                  ) : (
                    keywords.map((kw) => (
                      <tr key={kw.id} className={!kw.active ? "opacity-40" : ""}>
                        <td className="font-mono text-sm">{kw.keyword}</td>
                        <td>
                          <input
                            type="checkbox"
                            className="toggle toggle-sm toggle-primary"
                            checked={kw.active}
                            onChange={(e) => toggleKeyword(kw.id, e.target.checked)}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
