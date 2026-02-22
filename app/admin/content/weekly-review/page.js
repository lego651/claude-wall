"use client";

/**
 * Weekly Digest Review Page
 * /admin/content/weekly-review
 *
 * Unified page for admin to review firm content and Trustpilot incidents before sending weekly digest.
 * Industry news is no longer shown on this page.
 */

import { useState, useEffect } from "react";
import Link from "next/link";

// Inline icons (no extra deps); accept className
const IconCalendar = (p) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`size-6 ${p.className ?? ""}`.trim()} {...p}>
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);
const IconInfo = (p) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`size-5 shrink-0 ${p.className ?? ""}`.trim()} {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);
const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);
const IconRefresh = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21h5v-5" />
  </svg>
);
const IconChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
    <path d="m15 18-6-6 6-6" />
  </svg>
);
const IconAlert = (p) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`size-5 ${p.className ?? ""}`.trim()} {...p}>
    <path d="M12 9v4" />
    <path d="M10.363 3.591l-8.106 13.529a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636-2.87L13.637 3.59a1.914 1.914 0 0 0-3.274 0z" />
    <path d="M12 16h.01" />
  </svg>
);
const IconCheckbox = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" className="size-5">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);
const IconSquare = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
    <rect width="18" height="18" x="3" y="3" rx="2" />
  </svg>
);
const IconExternal = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 opacity-60">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" x2="21" y1="14" y2="3" />
  </svg>
);

export default function WeeklyReviewPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState("");
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
        : "/api/admin/content/weekly-review";
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load data");
      setData(json);

      const firmContentIds = new Set();
      const incidentIds = new Set();
      json.firmReviews.forEach((firm) => {
        ["company_news", "rule_change", "promotion"].forEach((type) => {
          firm.content[type].forEach((item) => {
            if (item.published) firmContentIds.add(item.id);
          });
        });
        firm.incidents.forEach((incident) => {
          if (incident.published !== false) incidentIds.add(incident.id);
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
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return { ...prev, firmContent: newSet };
    });
  };

  const toggleIncident = (id) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev.incidents);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return { ...prev, incidents: newSet };
    });
  };

  const selectAllForFirm = (firm) => {
    setSelectedItems((prev) => {
      const firmContentSet = new Set(prev.firmContent);
      const incidentSet = new Set(prev.incidents);
      const allContentIds = [...firm.content.company_news, ...firm.content.rule_change, ...firm.content.promotion].map((i) => i.id);
      const allIncidentIds = firm.incidents.map((i) => i.id);
      const allSelected = allContentIds.every((id) => firmContentSet.has(id)) && allIncidentIds.every((id) => incidentSet.has(id));
      if (allSelected) {
        allContentIds.forEach((id) => firmContentSet.delete(id));
        allIncidentIds.forEach((id) => incidentSet.delete(id));
      } else {
        allContentIds.forEach((id) => firmContentSet.add(id));
        allIncidentIds.forEach((id) => incidentSet.add(id));
      }
      return { ...prev, firmContent: firmContentSet, incidents: incidentSet };
    });
  };

  const handleBulkApprove = async () => {
    const totalSelected = selectedItems.firmContent.size + selectedItems.incidents.size;
    if (totalSelected === 0) {
      alert("No items selected");
      return;
    }
    if (!confirm(`Approve and publish ${totalSelected} items?`)) return;
    setBulkApproving(true);
    try {
      const res = await fetch("/api/admin/content/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firmContent: Array.from(selectedItems.firmContent),
          incidents: Array.from(selectedItems.incidents),
          weekNumber: data?.weekNumber,
          year: data?.year,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Bulk approve failed");
      alert(`✓ Successfully approved ${result.approvedCount} items!`);
      loadWeeklyReview();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setBulkApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="loading loading-spinner loading-lg text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          <p className="font-medium">{error}</p>
        </div>
      </div>
    );
  }

  const selectedCount = selectedItems.firmContent.size + selectedItems.incidents.size;
  const approvedCount = (data?.overallStats?.firmContent?.approved ?? 0) + (data?.overallStats?.incidents?.approved ?? 0);
  const pendingCount = (data?.overallStats?.firmContent?.pending ?? 0) + (data?.overallStats?.incidents?.pending ?? 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top nav */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-indigo-600"
          >
            <IconChevronLeft />
            Back to admin
          </Link>
          <Link
            href="/admin/content/upload"
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            + Add Content
          </Link>
        </div>

        {/* Title */}
        <div className="mb-8 flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <IconCalendar />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Weekly Digest Review</h1>
          </div>
          <p className="ml-13 text-sm font-medium text-slate-500">
            {data?.weekLabel} ({data?.weekStart} to {data?.weekEnd})
          </p>
        </div>

        {/* Info box */}
        <div className="mb-8 flex items-start gap-3 rounded-2xl bg-sky-500 p-5 text-white shadow-lg shadow-sky-500/10">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/20">
            <IconInfo />
          </div>
          <p className="text-sm font-medium leading-relaxed">
            <strong>How to use:</strong> Check the boxes next to items you want to publish, then click &quot;Approve &amp; Publish&quot; below. Already published items are auto-selected. Only published content appears in weekly digest emails.
          </p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-3xl font-bold tracking-tight text-slate-900">{data?.overallStats?.totalItems ?? 0}</span>
            <span className="text-sm font-medium text-slate-500">Total Items This Week</span>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-3xl font-bold tracking-tight text-emerald-500">{approvedCount}</span>
            <span className="text-sm font-medium text-slate-500">Already Approved</span>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-3xl font-bold tracking-tight text-amber-500">{pendingCount}</span>
            <span className="text-sm font-medium text-slate-500">Pending Review</span>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <span className="text-3xl font-bold tracking-tight text-sky-500">{selectedCount}</span>
            <span className="text-sm font-medium text-slate-500">Selected for Approval</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-12 flex items-center gap-4">
          <button
            onClick={handleBulkApprove}
            disabled={bulkApproving || selectedCount === 0}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 disabled:opacity-50 disabled:shadow-none active:scale-95 disabled:active:scale-100"
          >
            {bulkApproving ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Approving...
              </>
            ) : (
              <>
                <IconCheck />
                Approve &amp; Publish {selectedCount} Items
              </>
            )}
          </button>
          <button
            type="button"
            onClick={loadWeeklyReview}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
          >
            <IconRefresh />
            Refresh
          </button>
        </div>

        {/* Empty state */}
        {data?.overallStats?.totalItems === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center shadow-sm">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-2xl font-bold mb-2 text-slate-900">No Content This Week</h3>
            <p className="text-slate-500 mb-6">
              There&apos;s no firm content or incidents for {data?.weekLabel}. Upload some content to get started!
            </p>
            <Link
              href="/admin/content/upload"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              + Upload Content
            </Link>
          </div>
        )}

        {/* Firm sections */}
        <div className="flex flex-col gap-12 rounded-3xl border border-slate-200 bg-white/50 p-8 shadow-sm backdrop-blur-sm">
          {data?.firmReviews?.map((firm) => {
            const hasContent =
              firm.content.company_news.length > 0 ||
              firm.content.rule_change.length > 0 ||
              firm.content.promotion.length > 0 ||
              firm.incidents.length > 0;
            if (!hasContent) return null;

            const allContentIds = [
              ...firm.content.company_news,
              ...firm.content.rule_change,
              ...firm.content.promotion,
            ].map((i) => i.id);
            const allIncidentIds = firm.incidents.map((i) => i.id);
            const allIds = [...allContentIds, ...allIncidentIds];
            const isAllSelected = allIds.every(
              (id) => selectedItems.firmContent.has(id) || selectedItems.incidents.has(id)
            );

            return (
              <section key={firm.firmId} className="flex flex-col gap-6">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900">[{firm.firmName}]</h2>
                    <button
                      type="button"
                      onClick={() => selectAllForFirm(firm)}
                      className={`rounded-lg border px-4 py-2 text-sm font-semibold shadow-sm transition-all active:scale-95 ${
                        isAllSelected
                          ? "border-indigo-200 bg-indigo-50 text-indigo-600"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {isAllSelected ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-medium text-slate-400">
                    <span>{firm.stats.totalItems} items</span>
                    <span className="size-1 rounded-full bg-slate-300" />
                    <span className="text-emerald-600">{firm.stats.approvedItems} approved</span>
                    <span className="size-1 rounded-full bg-slate-300" />
                    <span>{firm.stats.pendingItems} pending</span>
                  </div>
                </div>

                {/* Incidents banner */}
                {firm.incidents.length > 0 && (
                  <div className="flex items-center gap-2 rounded-xl border border-indigo-100/50 bg-indigo-50/50 p-4">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                      <IconAlert />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">Trustpilot Incidents ({firm.incidents.length})</span>
                      <p className="text-xs text-slate-500">
                        Incidents are auto-approved by default. Uncheck to exclude from digest. Click review links to verify.
                      </p>
                    </div>
                  </div>
                )}

                {/* Incident cards */}
                {firm.incidents.length > 0 && (
                  <div className="grid gap-4">
                    {firm.incidents.map((incident) => (
                      <IncidentCard
                        key={incident.id}
                        incident={incident}
                        isSelected={selectedItems.incidents.has(incident.id)}
                        onToggle={toggleIncident}
                      />
                    ))}
                  </div>
                )}

                {/* Company news */}
                {firm.content.company_news.length > 0 && (
                  <div>
                    <h3 className="mb-2 font-bold text-slate-900">📢 Company News ({firm.content.company_news.length})</h3>
                    <div className="space-y-3">
                      {firm.content.company_news.map((item) => (
                        <ContentItem
                          key={item.id}
                          item={item}
                          selected={selectedItems.firmContent.has(item.id)}
                          onToggle={() => toggleFirmContent(item.id)}
                          accent="emerald"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Rule changes */}
                {firm.content.rule_change.length > 0 && (
                  <div>
                    <h3 className="mb-2 font-bold text-slate-900">⚠️ Rule Changes ({firm.content.rule_change.length})</h3>
                    <div className="space-y-3">
                      {firm.content.rule_change.map((item) => (
                        <ContentItem
                          key={item.id}
                          item={item}
                          selected={selectedItems.firmContent.has(item.id)}
                          onToggle={() => toggleFirmContent(item.id)}
                          accent="rose"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Promotions */}
                {firm.content.promotion.length > 0 && (
                  <div>
                    <h3 className="mb-2 font-bold text-slate-900">🎁 Promotions ({firm.content.promotion.length})</h3>
                    <div className="space-y-3">
                      {firm.content.promotion.map((item) => (
                        <ContentItem
                          key={item.id}
                          item={item}
                          selected={selectedItems.firmContent.has(item.id)}
                          onToggle={() => toggleFirmContent(item.id)}
                          accent="indigo"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Footer help */}
        <div className="mt-12 rounded-xl border border-slate-200 bg-slate-100/50 p-6">
          <h3 className="mb-2 font-bold text-slate-900">💡 How to use this page</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
            <li>Review all content that will be included in this week&apos;s digest</li>
            <li>Check items you want to approve (already published items are auto-selected)</li>
            <li>Click &quot;Approve &amp; Publish&quot; to publish them</li>
            <li>Only published content will be sent in the weekly digest emails</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

function IncidentCard({ incident, isSelected, onToggle }) {
  const severityClass =
    incident.severity === "high"
      ? "bg-rose-50 text-rose-600"
      : incident.severity === "medium"
        ? "bg-amber-50 text-amber-600"
        : "bg-emerald-50 text-emerald-600";

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-6 transition-all duration-300 ${
        isSelected ? "border-rose-200 bg-rose-50/20" : "border-slate-200 bg-white"
      } hover:shadow-lg hover:shadow-rose-500/5`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${severityClass}`}>
              <IconAlert className="size-3" />
              {incident.severity}
            </span>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-600">
              {incident.published !== false ? "Approved" : "Pending"}
            </span>
            <span className="text-xs font-medium text-slate-400">
              • Week {incident.week_number}, {incident.year}
            </span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 group-hover:text-rose-600 transition-colors">{incident.title}</h3>
          <p className="text-sm leading-relaxed text-slate-600">{incident.summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {incident.review_count} {incident.review_count === 1 ? "Review" : "Reviews"}
            </span>
            {incident.review_ids?.slice(0, 5).map((reviewId) => (
              <a
                key={reviewId}
                href={`/admin/dashboard?review=${reviewId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
              >
                Review #{reviewId}
                <IconExternal />
              </a>
            ))}
            {incident.review_ids?.length > 5 && (
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-500">+{incident.review_ids.length - 5} more</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-4">
          <button
            type="button"
            onClick={() => onToggle(incident.id)}
            className={`flex size-8 items-center justify-center rounded-lg transition-all ${
              isSelected ? "bg-rose-500 text-white shadow-md shadow-rose-500/20" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
            }`}
          >
            {isSelected ? <IconCheckbox /> : <IconSquare />}
          </button>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <IconAlert className="size-6" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ContentItem({ item, selected, onToggle, accent }) {
  const borderBg =
    accent === "emerald"
      ? "border-emerald-200 bg-emerald-50/20"
      : accent === "rose"
        ? "border-rose-200 bg-rose-50/20"
        : "border-indigo-200 bg-indigo-50/20";
  const btnBg = selected
    ? accent === "emerald"
      ? "bg-emerald-500 text-white"
      : accent === "rose"
        ? "bg-rose-500 text-white"
        : "bg-indigo-500 text-white"
    : "bg-slate-100 text-slate-400 hover:bg-slate-200";

  return (
    <div
      className={`rounded-2xl border p-4 transition-all ${
        selected ? borderBg : "border-slate-200 bg-white"
      } hover:shadow-md`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onToggle()}
          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg transition-all ${btnBg}`}
        >
          {selected ? <IconCheckbox /> : <IconSquare />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4 className="font-medium text-slate-900">{item.title}</h4>
            {item.published && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">Published</span>
            )}
            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500">
              {((item.ai_confidence ?? 0) * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-sm text-slate-600 mb-1">{item.ai_summary}</p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            <span>📅 {item.content_date}</span>
            {item.source_type && <span>• {item.source_type}</span>}
            {item.ai_tags?.length > 0 && <span>• 🏷️ {item.ai_tags.join(", ")}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
