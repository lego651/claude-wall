"use client";

/**
 * Weekly Digest Review Page
 * /admin/content/weekly-review
 *
 * Unified page for admin to review firm content and Trustpilot incidents before sending weekly digest.
 * Industry news is no longer shown on this page.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function WeeklyReviewPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [selectedItems, setSelectedItems] = useState({
    firmContent: new Set(),
    incidents: new Set(),
  });
  const [bulkApproving, setBulkApproving] = useState(false);

  useEffect(() => {
    loadWeeklyReview();
  }, [selectedWeek]);

  const loadWeeklyReview = async () => {
    setLoading(true);
    setError(null);

    try {
      const url = selectedWeek
        ? `/api/admin/content/weekly-review?week=${selectedWeek}`
        : '/api/admin/content/weekly-review';

      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to load data');
      }

      setData(json);

      // Auto-select all published items (including auto-approved incidents)
      const firmContentIds = new Set();
      const incidentIds = new Set();

      json.firmReviews.forEach((firm) => {
        ['company_news', 'rule_change', 'promotion'].forEach((type) => {
          firm.content[type].forEach((item) => {
            if (item.published) {
              firmContentIds.add(item.id);
            }
          });
        });

        firm.incidents.forEach((incident) => {
          if (incident.published !== false) {
            incidentIds.add(incident.id);
          }
        });
      });

      setSelectedItems({ firmContent: firmContentIds, incidents: incidentIds });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFirmContent = (id) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev.firmContent);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { ...prev, firmContent: newSet };
    });
  };

  const toggleIncident = (id) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev.incidents);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { ...prev, incidents: newSet };
    });
  };

  const selectAllForFirm = (firm) => {
    setSelectedItems((prev) => {
      const firmContentSet = new Set(prev.firmContent);
      const incidentSet = new Set(prev.incidents);

      ['company_news', 'rule_change', 'promotion'].forEach((type) => {
        firm.content[type].forEach((item) => {
          firmContentSet.add(item.id);
        });
      });

      firm.incidents.forEach((incident) => {
        incidentSet.add(incident.id);
      });

      return { ...prev, firmContent: firmContentSet, incidents: incidentSet };
    });
  };

  const handleBulkApprove = async () => {
    const totalSelected = selectedItems.firmContent.size + selectedItems.incidents.size;

    if (totalSelected === 0) {
      alert('No items selected');
      return;
    }

    if (!confirm(`Approve and publish ${totalSelected} items?`)) {
      return;
    }

    setBulkApproving(true);

    try {
      const res = await fetch('/api/admin/content/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firmContent: Array.from(selectedItems.firmContent),
          incidents: Array.from(selectedItems.incidents),
          weekNumber: data?.weekNumber,
          year: data?.year,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Bulk approve failed');
      }

      alert(`✓ Successfully approved ${result.approvedCount} items!`);
      loadWeeklyReview(); // Reload data
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setBulkApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      </div>
    );
  }

  const selectedCount = selectedItems.firmContent.size + selectedItems.incidents.size;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">📅 Weekly Digest Review</h1>
            <p className="text-base-content/60 mt-2">
              {data?.weekLabel} ({data?.weekStart} to {data?.weekEnd})
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/content/upload" className="btn btn-outline btn-sm">
              + Add Content
            </Link>
          </div>
        </div>

        {/* Instructions Banner */}
        {data?.overallStats.totalItems > 0 && (
          <div className="alert alert-info mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div className="text-sm">
              <strong>How to use:</strong> Check the boxes next to items you want to publish, then click "Approve & Publish" button below.
              Already published items are auto-selected. Only published content appears in weekly digest emails.
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="card card-border bg-base-100 shadow">
            <div className="card-body p-4">
              <div className="text-2xl font-bold">{data?.overallStats.totalItems}</div>
              <div className="text-sm text-base-content/60">Total Items This Week</div>
            </div>
          </div>
          <div className="card card-border bg-base-100 shadow">
            <div className="card-body p-4">
              <div className="text-2xl font-bold text-success">
                {data?.overallStats.firmContent.approved + (data?.overallStats.incidents?.approved || 0)}
              </div>
              <div className="text-sm text-base-content/60">Already Approved</div>
            </div>
          </div>
          <div className="card card-border bg-base-100 shadow">
            <div className="card-body p-4">
              <div className="text-2xl font-bold text-warning">
                {data?.overallStats.firmContent.pending + (data?.overallStats.incidents?.pending || 0)}
              </div>
              <div className="text-sm text-base-content/60">Pending Review</div>
            </div>
          </div>
          <div className="card card-border bg-base-100 shadow">
            <div className="card-body p-4">
              <div className="text-2xl font-bold text-info">{selectedCount}</div>
              <div className="text-sm text-base-content/60">Selected for Approval</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleBulkApprove}
            className="btn btn-success btn-lg"
            disabled={bulkApproving || selectedCount === 0}
          >
            {bulkApproving ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Approving...
              </>
            ) : (
              `✓ Approve & Publish ${selectedCount} Items`
            )}
          </button>
          <button className="btn btn-outline btn-lg" onClick={loadWeeklyReview}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Empty State */}
      {data?.overallStats.totalItems === 0 && (
        <div className="card card-border bg-base-100 shadow">
          <div className="card-body text-center py-16">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-2xl font-bold mb-2">No Content This Week</h3>
            <p className="text-base-content/60 mb-6">
              There's no firm content or incidents for {data?.weekLabel}.
              <br />
              Upload some content to get started!
            </p>
            <Link href="/admin/content/upload" className="btn btn-primary">
              + Upload Content
            </Link>
          </div>
        </div>
      )}

      {/* Firm Reviews */}
      <div className="space-y-6">
        {data?.firmReviews.map((firm) => {
          const hasContent =
            firm.content.company_news.length > 0 ||
            firm.content.rule_change.length > 0 ||
            firm.content.promotion.length > 0 ||
            firm.incidents.length > 0;

          if (!hasContent) return null;

          return (
            <div key={firm.firmId} className="card card-border bg-base-100 shadow">
              <div className="card-body">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold">[{firm.firmName}]</h2>
                    <p className="text-sm text-base-content/60">
                      {firm.stats.totalItems} items • {firm.stats.approvedItems} approved • {firm.stats.pendingItems} pending
                    </p>
                  </div>
                  <button
                    onClick={() => selectAllForFirm(firm)}
                    className="btn btn-outline btn-sm"
                  >
                    Select All
                  </button>
                </div>

                {/* Company News */}
                {firm.content.company_news.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-bold mb-2">📢 Company News ({firm.content.company_news.length})</h3>
                    <div className="space-y-2">
                      {firm.content.company_news.map((item) => (
                        <ContentItem
                          key={item.id}
                          item={item}
                          selected={selectedItems.firmContent.has(item.id)}
                          onToggle={() => toggleFirmContent(item.id)}
                          color="success"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Rule Changes */}
                {firm.content.rule_change.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-bold mb-2">⚠️ Rule Changes ({firm.content.rule_change.length})</h3>
                    <div className="space-y-2">
                      {firm.content.rule_change.map((item) => (
                        <ContentItem
                          key={item.id}
                          item={item}
                          selected={selectedItems.firmContent.has(item.id)}
                          onToggle={() => toggleFirmContent(item.id)}
                          color="error"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Promotions */}
                {firm.content.promotion.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-bold mb-2">🎁 Promotions ({firm.content.promotion.length})</h3>
                    <div className="space-y-2">
                      {firm.content.promotion.map((item) => (
                        <ContentItem
                          key={item.id}
                          item={item}
                          selected={selectedItems.firmContent.has(item.id)}
                          onToggle={() => toggleFirmContent(item.id)}
                          color="secondary"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Trustpilot Incidents */}
                {firm.incidents.length > 0 && (
                  <div>
                    <h3 className="font-bold mb-2">🚨 Trustpilot Incidents ({firm.incidents.length})</h3>
                    <div className="text-xs text-base-content/50 mb-2">
                      ℹ️ Incidents are auto-approved by default. Uncheck to exclude from digest. Click review links to verify.
                    </div>
                    <div className="space-y-2">
                      {firm.incidents.map((incident) => (
                        <div
                          key={incident.id}
                          className={`p-3 rounded-lg border ${
                            selectedItems.incidents.has(incident.id)
                              ? 'border-error bg-error/5'
                              : 'border-base-300 bg-base-200'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-error mt-1"
                              checked={selectedItems.incidents.has(incident.id)}
                              onChange={() => toggleIncident(incident.id)}
                            />
                            <span className={`badge badge-${incident.severity === 'high' ? 'error' : incident.severity === 'medium' ? 'warning' : 'success'} badge-sm mt-1`}>
                              {incident.severity}
                            </span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="font-medium">{incident.title}</div>
                                {incident.published !== false && <span className="badge badge-success badge-sm">Auto-Approved</span>}
                              </div>
                              <div className="text-sm text-base-content/70 mb-2">{incident.summary}</div>
                              <div className="text-xs text-base-content/50">
                                {incident.review_count} reviews • Week {incident.week_number}, {incident.year}
                              </div>
                              {incident.review_ids && incident.review_ids.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {incident.review_ids.slice(0, 5).map((reviewId) => (
                                    <a
                                      key={reviewId}
                                      href={`/admin/dashboard?review=${reviewId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="badge badge-outline badge-xs hover:badge-primary"
                                    >
                                      Review #{reviewId}
                                    </a>
                                  ))}
                                  {incident.review_ids.length > 5 && (
                                    <span className="badge badge-ghost badge-xs">
                                      +{incident.review_ids.length - 5} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Help Text */}
      <div className="mt-6 p-4 bg-base-200 rounded-lg">
        <h3 className="font-bold mb-2">💡 How to use this page</h3>
        <ul className="text-sm space-y-1 list-disc list-inside text-base-content/70">
          <li>Review all content that will be included in this week's digest</li>
          <li>Check items you want to approve (already published items are auto-selected)</li>
          <li>Click "Approve X Items" to publish them</li>
          <li>Only published content will be sent in the weekly digest emails</li>
          <li>Trustpilot incidents are always included (cannot be toggled)</li>
        </ul>
      </div>
    </div>
  );
}

function ContentItem({ item, selected, onToggle, color }) {
  return (
    <div
      className={`p-3 border rounded-lg ${
        selected ? `border-${color} bg-${color}/5` : 'border-base-300'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className={`checkbox checkbox-${color} mt-1`}
          checked={selected}
          onChange={onToggle}
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium">{item.title}</h4>
            {item.published && <span className="badge badge-success badge-sm">Published</span>}
            <span className="badge badge-outline badge-sm">
              {(item.ai_confidence * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-sm text-base-content/70 mb-1">{item.ai_summary}</p>
          <div className="flex gap-2 text-xs text-base-content/50">
            <span>📅 {item.content_date}</span>
            {item.source_type && <span>• 📍 {item.source_type}</span>}
            {item.ai_tags?.length > 0 && <span>• 🏷️ {item.ai_tags.join(', ')}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
