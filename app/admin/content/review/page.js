"use client";

/**
 * Content Review Queue (TICKET-S8-008)
 * /admin/content/review
 *
 * Admin UI to review and approve/delete pending or published firm content and industry news.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminContentReviewPage() {
  const [items, setItems] = useState({ firm_content: [], industry_news: [], firm_tweets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('pending');
  const [industrySourceType, setIndustrySourceType] = useState(''); // '' = all, 'twitter' = Twitter only (S8-TW-007)
  const [showFirmTweets, setShowFirmTweets] = useState(false); // S8-TW-007: recent firm_twitter_tweets

  const loadContent = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status });
      if (industrySourceType) params.set('industry_source_type', industrySourceType);
      if (showFirmTweets) params.set('include_firm_tweets', '1');
      const res = await fetch(`/api/admin/content/review?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setItems({
        firm_content: data.firm_content || [],
        industry_news: data.industry_news || [],
        firm_tweets: data.firm_tweets || [],
      });
    } catch (err) {
      setError(err.message);
      setItems({ firm_content: [], industry_news: [], firm_tweets: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContent();
  }, [status, industrySourceType, showFirmTweets]);

  const handleApprove = async (type, id) => {
    if (!confirm('Approve and publish this content?')) return;
    try {
      const res = await fetch(`/api/admin/content/${type}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: true }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      loadContent();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (type, id) => {
    if (!confirm('Delete this content permanently?')) return;
    try {
      const res = await fetch(`/api/admin/content/${type}/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      loadContent();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Content Review Queue</h1>
          <p className="text-base-content/60 mt-1">Approve or delete firm content and industry news.</p>
        </div>
        <div className="flex gap-2">
          <select
            className="select select-bordered select-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="pending">Pending</option>
            <option value="published">Published</option>
            <option value="all">All</option>
          </select>
          <select
            className="select select-bordered select-sm"
            value={industrySourceType}
            onChange={(e) => setIndustrySourceType(e.target.value)}
            title="Filter industry news by source"
          >
            <option value="">Industry: All</option>
            <option value="twitter">Industry: Twitter only</option>
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={showFirmTweets}
              onChange={(e) => setShowFirmTweets(e.target.checked)}
            />
            <span className="text-sm">Firm tweets</span>
          </label>
          <Link href="/admin/content/upload" className="btn btn-ghost btn-sm">
            + Upload
          </Link>
          <Link href="/admin/content/weekly-review" className="btn btn-outline btn-sm">
            Weekly review
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-error mb-4">
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-bold mb-3">Firm Content ({items.firm_content.length})</h2>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Firm</th>
                    <th>Type</th>
                    <th>Title</th>
                    <th>AI Summary</th>
                    <th>Confidence</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.firm_content.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center text-base-content/60">
                        No firm content
                      </td>
                    </tr>
                  ) : (
                    items.firm_content.map((item) => (
                      <tr key={item.id}>
                        <td>{item.content_date}</td>
                        <td>{item.firm_id}</td>
                        <td>{item.content_type}</td>
                        <td className="max-w-[200px] truncate" title={item.title}>
                          {item.title}
                        </td>
                        <td className="max-w-xs truncate" title={item.ai_summary}>
                          {item.ai_summary || '—'}
                        </td>
                        <td>
                          {item.ai_confidence != null ? `${Math.round(item.ai_confidence * 100)}%` : '—'}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            {!item.published && (
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                                onClick={() => handleApprove('firm', item.id)}
                              >
                                Approve
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-error btn-sm"
                              onClick={() => handleDelete('firm', item.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {showFirmTweets && (
            <div>
              <h2 className="text-lg font-bold mb-3">Firm tweets (recent, read-only) ({items.firm_tweets.length})</h2>
              {items.firm_tweets.length === 0 ? (
                <p className="text-base-content/60">No firm tweets in DB. Run the Twitter fetch + ingest job to populate.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-zebra">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Firm</th>
                        <th>Author</th>
                        <th>Summary</th>
                        <th>Importance</th>
                        <th>Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.firm_tweets.map((t) => (
                        <tr key={t.id}>
                          <td>{t.tweeted_at}</td>
                          <td>{t.firm_id}</td>
                          <td>{t.author_username ? `@${t.author_username}` : '—'}</td>
                          <td className="max-w-xs truncate" title={t.ai_summary || t.text}>
                            {t.ai_summary || (t.text && t.text.slice(0, 80)) || '—'}
                          </td>
                          <td>{t.importance_score != null ? `${Math.round(t.importance_score * 100)}%` : '—'}</td>
                          <td>
                            {t.url ? (
                              <a href={t.url} target="_blank" rel="noopener noreferrer" className="link link-hover text-sm">
                                View
                              </a>
                            ) : '—'}
                            </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div>
            <h2 className="text-lg font-bold mb-3">Industry News ({items.industry_news.length})</h2>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Title</th>
                    <th>AI Summary</th>
                    <th>Mentioned Firms</th>
                    <th>Confidence</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.industry_news.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-base-content/60">
                        No industry news
                      </td>
                    </tr>
                  ) : (
                    items.industry_news.map((item) => (
                      <tr key={item.id}>
                        <td>{item.content_date}</td>
                        <td className="max-w-[200px] truncate" title={item.title}>
                          {item.title}
                        </td>
                        <td className="max-w-xs truncate" title={item.ai_summary}>
                          {item.ai_summary || '—'}
                        </td>
                        <td>
                          {Array.isArray(item.mentioned_firm_ids) && item.mentioned_firm_ids.length > 0
                            ? item.mentioned_firm_ids.join(', ')
                            : '—'}
                        </td>
                        <td>
                          {item.ai_confidence != null ? `${Math.round(item.ai_confidence * 100)}%` : '—'}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            {!item.published && (
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                                onClick={() => handleApprove('industry', item.id)}
                              >
                                Approve
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-error btn-sm"
                              onClick={() => handleDelete('industry', item.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
