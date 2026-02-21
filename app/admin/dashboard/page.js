"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/common/AdminLayout";

const REFRESH_MS = 30_000;

function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${n} B`;
}

/** Compute overall dashboard status and list of issues for the summary banner. */
function getSummaryStatus(data) {
  if (!data) return { status: "unknown", issues: [], label: "No data" };
  const issues = [];
  let hasCritical = false;
  let hasWarning = false;

  // Checks
  const fileStatus = data.checks?.fileSize?.status;
  if (fileStatus === "critical") {
    hasCritical = true;
    issues.push("File size critical (≥10 MB)");
  } else if (fileStatus === "warning") {
    hasWarning = true;
    issues.push("File size warning (≥5 MB)");
  }
  const arbStatus = data.checks?.arbiscan?.status;
  if (arbStatus === "critical") {
    hasCritical = true;
    issues.push("Arbiscan usage ≥95%");
  } else if (arbStatus === "warning") {
    hasWarning = true;
    issues.push("Arbiscan usage ≥80%");
  }
  if (data.checks?.supabase?.status === "critical") {
    hasCritical = true;
    issues.push("Database check failed");
  }
  const propStatus = data.checks?.propfirmsData?.status;
  if (propStatus === "critical") {
    hasCritical = true;
    issues.push("Prop firms payout data critical");
  } else if (propStatus === "warning") {
    hasWarning = true;
    issues.push("Prop firms payout data warning");
  }

  // Daily 1: Scraper
  const firms = data.trustpilotScraper?.firms ?? [];
  const scraperTimestamps = firms.map((f) => f.last_scraper_run_at).filter(Boolean);
  const lastScraperRun = scraperTimestamps.length ? Math.max(...scraperTimestamps.map((t) => new Date(t).getTime())) : null;
  const hoursSinceScraper = lastScraperRun ? (Date.now() - lastScraperRun) / (1000 * 60 * 60) : Infinity;
  if (!lastScraperRun) {
    hasCritical = true;
    issues.push("Daily 1: Scraper never run");
  } else if (hoursSinceScraper > 25) {
    hasWarning = true;
    issues.push(`Daily 1: Scraper stale (${Math.round(hoursSinceScraper)}h ago)`);
  }

  // Daily 2: Classifier backlog
  const unclassified = data.classifyReviews?.unclassified ?? 0;
  if (unclassified > 1000) {
    hasCritical = true;
    issues.push(`Daily 2: Classifier backlog critical (${unclassified} unclassified)`);
  } else if (unclassified > 500) {
    hasWarning = true;
    issues.push(`Daily 2: Classifier backlog (${unclassified} unclassified)`);
  }

  // Weekly 2: Email failures
  const failed = data.weeklyEmailReport?.failed ?? 0;
  if (failed > 0 && data.weeklyEmailReport?.lastRunAt) {
    hasWarning = true;
    issues.push(`Weekly 2: Last email run had ${failed} failed`);
  }

  // Traders: sync errors or many pending backfills
  const tradersSummary = data.traders?.summary;
  if (tradersSummary) {
    const syncErr = tradersSummary.syncErrors ?? 0;
    const pending = tradersSummary.pendingBackfill ?? 0;
    if (syncErr > 0) {
      hasWarning = true;
      issues.push(`Traders: ${syncErr} sync error(s)`);
    }
    if (pending > 5) {
      hasWarning = true;
      issues.push(`Traders: ${pending} pending backfill(s)`);
    }
  }

  const status = hasCritical ? "critical" : hasWarning ? "warning" : "ok";
  const label = hasCritical ? "Critical" : hasWarning ? "Warning" : "All good";
  return { status, issues, label };
}

function metricsToCSV(data) {
  const rows = [];
  rows.push("metric,value");
  if (data?.checks) {
    rows.push(`check_fileSize,${data.checks.fileSize?.status ?? ""}`);
    rows.push(`check_arbiscan,${data.checks.arbiscan?.status ?? ""}`);
    rows.push(`check_supabase,${data.checks.supabase?.status ?? ""}`);
    rows.push(`check_propfirmsData,${data.checks.propfirmsData?.status ?? ""}`);
  }
  if (data?.propfirmsData?.firmsWithIssues?.length) {
    data.propfirmsData.firmsWithIssues.forEach((f, i) => {
      rows.push(`propfirms_issue_${i + 1}_firm,${f.firmName ?? f.firmId}`);
      rows.push(`propfirms_issue_${i + 1}_status,${f.status}`);
      rows.push(`propfirms_issue_${i + 1}_counts,${f.counts?.["24h"] ?? ""}/${f.counts?.["7d"] ?? ""}/${f.counts?.["30d"] ?? ""}`);
    });
  }
  rows.push(`arbiscan_calls,${data?.arbiscan?.calls ?? ""}`);
  rows.push(`arbiscan_limit,${data?.arbiscan?.limit ?? ""}`);
  rows.push(`arbiscan_percentage,${data?.arbiscan?.percentage ?? ""}`);
  rows.push(`files_totalBytes,${data?.files?.totalBytes ?? ""}`);
  rows.push(`files_totalFiles,${data?.files?.totalFiles ?? ""}`);
  rows.push(`files_totalMB,${data?.files?.totalMB ?? ""}`);
  rows.push(`cache_hits,${data?.cache?.hits ?? ""}`);
  rows.push(`cache_misses,${data?.cache?.misses ?? ""}`);
  rows.push(`cache_hitRate,${data?.cache?.hitRate ?? ""}`);
  if (data?.database) {
    Object.entries(data.database).forEach(([k, v]) => rows.push(`db_${k},${v ?? ""}`));
  }
  if (data?.trustpilotScraper?.firms?.length) {
    data.trustpilotScraper.firms.forEach((f) => {
      rows.push(`trustpilot_${f.id}_lastRun,${f.last_scraper_run_at ?? ""}`);
      rows.push(`trustpilot_${f.id}_scraped,${f.last_scraper_reviews_scraped ?? ""}`);
      rows.push(`trustpilot_${f.id}_stored,${f.last_scraper_reviews_stored ?? ""}`);
      rows.push(`trustpilot_${f.id}_error,${f.last_scraper_error ?? ""}`);
    });
  }
  if (data?.intelligenceFeed) {
    rows.push(`intelligence_subscriptionsTotal,${data.intelligenceFeed.subscriptionsTotal ?? ""}`);
    rows.push(`intelligence_subscriptionsEmailEnabled,${data.intelligenceFeed.subscriptionsEmailEnabled ?? ""}`);
    rows.push(`intelligence_lastWeek,${data.intelligenceFeed.weekLabel ?? ""}`);
    rows.push(`intelligence_lastWeek_firmsWithReport,${data.intelligenceFeed.lastWeek?.firmsWithReport ?? ""}`);
    rows.push(`intelligence_lastWeek_firmsExpected,${data.intelligenceFeed.lastWeek?.firmsExpected ?? ""}`);
  }
  if (data?.generateWeeklyReportsRun) {
    rows.push(`generateWeeklyReports_lastRunAt,${data.generateWeeklyReportsRun.lastRunAt ?? ""}`);
    rows.push(`generateWeeklyReports_firmsProcessed,${data.generateWeeklyReportsRun.firmsProcessed ?? ""}`);
    rows.push(`generateWeeklyReports_successCount,${data.generateWeeklyReportsRun.successCount ?? ""}`);
    rows.push(`generateWeeklyReports_errorCount,${data.generateWeeklyReportsRun.errorCount ?? ""}`);
    rows.push(`generateWeeklyReports_weekLabel,${data.generateWeeklyReportsRun.weekLabel ?? ""}`);
    rows.push(`generateWeeklyReports_durationMs,${data.generateWeeklyReportsRun.durationMs ?? ""}`);
  }
  if (data?.weeklyEmailReport) {
    rows.push(`weeklyEmail_lastRunAt,${data.weeklyEmailReport.lastRunAt ?? ""}`);
    rows.push(`weeklyEmail_sent,${data.weeklyEmailReport.sent ?? ""}`);
    rows.push(`weeklyEmail_failed,${data.weeklyEmailReport.failed ?? ""}`);
    rows.push(`weeklyEmail_skipped,${data.weeklyEmailReport.skipped ?? ""}`);
    rows.push(`weeklyEmail_weekStart,${data.weeklyEmailReport.weekStart ?? ""}`);
    rows.push(`weeklyEmail_weekEnd,${data.weeklyEmailReport.weekEnd ?? ""}`);
  }
  if (data?.traders?.summary) {
    const s = data.traders.summary;
    rows.push(`traders_totalProfiles,${s.totalProfiles ?? ""}`);
    rows.push(`traders_withWallet,${s.withWallet ?? ""}`);
    rows.push(`traders_backfilled,${s.backfilled ?? ""}`);
    rows.push(`traders_pendingBackfill,${s.pendingBackfill ?? ""}`);
    rows.push(`traders_syncErrors,${s.syncErrors ?? ""}`);
  }
  rows.push(`fetchedAt,${data?.fetchedAt ?? ""}`);
  return rows.join("\n");
}

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [testAlertLoading, setTestAlertLoading] = useState(false);
  const [testAlertResult, setTestAlertResult] = useState(null);
  const [propfirmsTooltip, setPropfirmsTooltip] = useState(null);
  const [classifyStatus, setClassifyStatus] = useState(null);
  const [classifyRunResult, setClassifyRunResult] = useState(null);
  const [classifyRunLoading, setClassifyRunLoading] = useState(false);
  const [classifyLimit, setClassifyLimit] = useState(40);
  const [activeTab, setActiveTab] = useState("system");

  const summary = getSummaryStatus(data);
  const TAB_IDS = ["system", "traders", "daily1", "daily2", "daily3", "weekly1", "weekly2", "payouts"];
  /** Map summary issue text to tab id for "go to" links. */
  const getTabForIssue = (msg) => {
    if (!msg) return null;
    if (msg.startsWith("Daily 1") || msg.includes("Scraper")) return "daily1";
    if (msg.startsWith("Daily 2") || msg.includes("Classifier")) return "daily2";
    if (msg.startsWith("Daily 3")) return "daily3";
    if (msg.startsWith("Weekly 1")) return "weekly1";
    if (msg.startsWith("Weekly 2") || msg.includes("email")) return "weekly2";
    if (msg.includes("Prop firms") || msg.includes("Arbiscan") || msg.includes("File size")) return "payouts";
    if (msg.includes("Traders") || msg.includes("trader") || msg.includes("backfill") || msg.includes("sync")) return "traders";
    if (msg.includes("Database")) return "system";
    return null;
  };
  const TAB_LABELS = {
    system: "System",
    traders: "Traders",
    daily1: "Daily 1 – Scrape",
    daily2: "Daily 2 – Classify",
    daily3: "Daily 3 – Incidents",
    weekly1: "Weekly 1 – Reports",
    weekly2: "Weekly 2 – Digest",
    payouts: "Payouts & data",
  };
  /** Tab ids that show "Last run" under the tab label. */
  const STEP_TAB_IDS = ["daily1", "daily2", "daily3", "weekly1", "weekly2"];

  /** Format last run for tab: relative (e.g. "2h ago") or short date if older. */
  const formatLastRun = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const diffM = diffMs / (60 * 1000);
    const diffH = diffMs / (60 * 60 * 1000);
    const diffD = diffMs / (24 * 60 * 60 * 1000);
    if (diffM < 60) return `${Math.round(diffM)}m ago`;
    if (diffH < 24) return `${Math.round(diffH)}h ago`;
    if (diffD < 7) return `${Math.round(diffD)}d ago`;
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  };

  /** Last run per step for nav tabs (system/payouts have no single "run"). */
  const getTabLastRun = (tabId) => {
    if (!data) return null;
    if (tabId === "daily1") {
      const times = data.trustpilotScraper?.firms?.map((f) => f.last_scraper_run_at).filter(Boolean) || [];
      if (!times.length) return null;
      return new Date(Math.max(...times.map((t) => new Date(t).getTime()))).toISOString();
    }
    if (tabId === "daily2") return classifyStatus?.lastClassifiedAt ?? null;
    if (tabId === "daily3") return data.incidentDetection?.lastRunAt ?? null;
    if (tabId === "weekly1") return data.generateWeeklyReportsRun?.lastRunAt ?? null;
    if (tabId === "weekly2") return data.weeklyEmailReport?.lastRunAt ?? null;
    return null;
  };

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/metrics");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const id = setInterval(fetchMetrics, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchMetrics]);

  const fetchClassifyStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/classify-reviews/status");
      if (res.ok) {
        const json = await res.json();
        setClassifyStatus(json);
      }
    } catch {
      setClassifyStatus(null);
    }
  }, []);

  useEffect(() => {
    if (data && !loading) fetchClassifyStatus();
  }, [data, loading, fetchClassifyStatus]);

  const runClassify = async () => {
    setClassifyRunResult(null);
    setClassifyRunLoading(true);
    try {
      const res = await fetch("/api/admin/classify-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: classifyLimit }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setClassifyRunResult({ error: json.error || `HTTP ${res.status}` });
      } else {
        setClassifyRunResult(json);
        fetchClassifyStatus();
      }
    } catch (e) {
      setClassifyRunResult({ error: e.message });
    } finally {
      setClassifyRunLoading(false);
    }
  };

  const exportCSV = () => {
    if (!data) return;
    const csv = metricsToCSV(data);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-metrics-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return (
      <AdminLayout>
        <div className="bg-white border-b border-slate-200 w-full">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Admin Dashboard</h1>
            <p className="text-sm text-slate-500">Monitoring &amp; alerts</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-12 flex items-center justify-center">
          <span className="loading loading-spinner loading-lg" style={{ color: "#635BFF" }} />
        </div>
      </AdminLayout>
    );
  }

  const sendTestAlert = async () => {
    setTestAlertResult(null);
    setTestAlertLoading(true);
    try {
      const res = await fetch("/api/admin/test-alert", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (res.ok) setTestAlertResult("sent");
      else setTestAlertResult(json.error || `HTTP ${res.status}`);
    } catch (e) {
      setTestAlertResult(e.message || "Request failed");
    } finally {
      setTestAlertLoading(false);
    }
  };

  return (
    <AdminLayout>
      {/* Header - same style as My Dashboard */}
      <div className="bg-white border-b border-slate-200 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Admin Dashboard</h1>
              <p className="text-sm text-slate-500">
                Monitoring &amp; alerts in one place. Auto-refresh every {REFRESH_MS / 1000}s.
                {data?.fetchedAt && (
                  <span className="ml-1">Last fetched: {new Date(data.fetchedAt).toLocaleString()}</span>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={fetchMetrics}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "Refreshing…" : "Refresh now"}
              </button>
              <button
                type="button"
                onClick={exportCSV}
                className="px-6 py-2 text-white rounded-lg font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
                style={{ backgroundColor: "#635BFF" }}
                onMouseEnter={(e) => { if (!data) return; e.currentTarget.style.backgroundColor = "#5a52e6"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#635BFF"; }}
                disabled={!data}
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            <span>{error}</span>
          </div>
        )}

        {!data && !loading && (
          <div className="text-slate-600">No metrics available.</div>
        )}

        {/* Overall status summary */}
        {data && (
          <div className="mb-6">
            <div
              className={`rounded-2xl border p-4 sm:p-5 ${
                summary.status === "critical"
                  ? "border-red-300 bg-red-50"
                  : summary.status === "warning"
                    ? "border-amber-300 bg-amber-50"
                    : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <div className="flex flex-wrap items-center gap-4">
                <span
                  className={`text-xl font-bold ${
                    summary.status === "critical"
                      ? "text-red-700"
                      : summary.status === "warning"
                        ? "text-amber-700"
                        : "text-emerald-700"
                  }`}
                >
                  {summary.status === "critical" ? "🔴 Critical" : summary.status === "warning" ? "🟡 Warning" : "🟢 All good"}
                </span>
                <span className="text-slate-700 font-medium">{summary.label}</span>
                {summary.issues.length > 0 && (
                  <ul className="list-disc list-inside text-sm text-slate-600 mt-1 flex-1 space-y-0.5">
                    {summary.issues.slice(0, 6).map((msg, i) => {
                      const tabId = getTabForIssue(msg);
                      return (
                        <li key={i}>
                          {tabId ? (
                            <button
                              type="button"
                              onClick={() => setActiveTab(tabId)}
                              className="text-left font-medium text-slate-700 underline-offset-2 hover:underline hover:text-slate-900"
                            >
                              {msg}
                              <span className="ml-1 text-xs text-slate-500">→ {TAB_LABELS[tabId]}</span>
                            </button>
                          ) : (
                            msg
                          )}
                        </li>
                      );
                    })}
                    {summary.issues.length > 6 && <li>… and {summary.issues.length - 6} more</li>}
                  </ul>
                )}
              </div>
            </div>
            {/* Navigation tabs */}
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mt-6 mb-2">Sections</p>
            <nav role="tablist" aria-label="Dashboard sections" className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl">
              {TAB_IDS.map((id) => {
                const lastRun = getTabLastRun(id);
                return (
                  <button
                    key={id}
                    role="tab"
                    type="button"
                    aria-selected={activeTab === id}
                    className={`min-w-0 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors flex flex-col items-center gap-0.5 ${
                      activeTab === id
                        ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                        : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                    }`}
                    onClick={() => setActiveTab(id)}
                  >
                    <span>{TAB_LABELS[id]}</span>
                    {(STEP_TAB_IDS.includes(id) && (lastRun != null ? (
                      <span className={`text-[10px] font-normal ${activeTab === id ? "text-slate-500" : "text-slate-400"}`} title={lastRun ? new Date(lastRun).toLocaleString() : ""}>
                        Last: {formatLastRun(lastRun)}
                      </span>
                    ) : (
                      <span className={`text-[10px] font-normal ${activeTab === id ? "text-slate-400" : "text-slate-400"}`}>Last: —</span>
                    ))) || null}
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {data?.traders && activeTab === "traders" && (
          <div className="space-y-8">
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900 mb-2">Trader monitoring</h2>
                <p className="text-sm text-slate-500">
                  Sign-up, wallet linking, historical backfill, and real-time payout sync status per trader.
                </p>
              </div>
              {data.traders.error ? (
                <div className="p-6 rounded-xl border border-red-200 bg-red-50 text-red-800 mx-6 mt-4">
                  <span>{data.traders.error}</span>
                </div>
              ) : (
                <div className="p-6">
                  {data.traders.summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Profiles (signed up)</div>
                        <div className="text-2xl font-bold text-slate-900 mt-1" style={{ color: "#635BFF" }}>{data.traders.summary.totalProfiles ?? 0}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Wallet linked</div>
                        <div className="text-2xl font-bold text-slate-900 mt-1">{data.traders.summary.withWallet ?? 0}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Backfill done</div>
                        <div className="text-2xl font-bold text-emerald-600 mt-1">{data.traders.summary.backfilled ?? 0}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pending backfill</div>
                        <div className={`text-2xl font-bold mt-1 ${(data.traders.summary.pendingBackfill ?? 0) > 0 ? "text-amber-600" : "text-slate-900"}`}>
                          {data.traders.summary.pendingBackfill ?? 0}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Sync errors</div>
                        <div className={`text-2xl font-bold mt-1 ${(data.traders.summary.syncErrors ?? 0) > 0 ? "text-red-600" : "text-slate-900"}`}>
                          {data.traders.summary.syncErrors ?? 0}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/80">
                            <th className="text-left font-semibold text-slate-700 px-4 py-3">Email / Handle</th>
                            <th className="text-left font-semibold text-slate-700 px-4 py-3">Wallet</th>
                            <th className="text-right font-semibold text-slate-700 px-4 py-3">Signed up</th>
                            <th className="text-right font-semibold text-slate-700 px-4 py-3">Wallet linked</th>
                            <th className="text-center font-semibold text-slate-700 px-4 py-3">Backfill</th>
                            <th className="text-center font-semibold text-slate-700 px-4 py-3">Realtime sync</th>
                            <th className="text-right font-semibold text-slate-700 px-4 py-3">Payouts</th>
                            <th className="text-left font-semibold text-slate-700 px-4 py-3">Errors</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.traders.traders ?? []).map((t) => {
                            const backfillStatus = t.wallet_address
                              ? t.backfilled_at
                                ? "ok"
                                : "pending"
                              : "—";
                            const syncStatus = t.sync_error ? "error" : t.last_synced_at ? "ok" : t.wallet_address ? "pending" : "—";
                            return (
                              <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                <td className="px-4 py-3">
                                  <div className="font-medium truncate max-w-[180px] text-slate-900" title={t.email}>
                                    {t.display_name || t.email || "—"}
                                  </div>
                                  {(t.handle || t.email) && (
                                    <div className="text-xs text-slate-500 truncate max-w-[180px]">
                                      {t.handle ? `@${t.handle}` : t.email}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  {t.wallet_address ? (
                                    <span className="font-mono text-xs text-slate-600" title={t.wallet_address}>
                                      {t.wallet_address.slice(0, 6)}…{t.wallet_address.slice(-4)}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="text-right text-slate-600 text-xs tabular-nums px-4 py-3">
                                  {t.created_at ? new Date(t.created_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : "—"}
                                </td>
                                <td className="text-right text-slate-600 text-xs tabular-nums px-4 py-3">
                                  {t.wallet_address && t.updated_at
                                    ? new Date(t.updated_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
                                    : "—"}
                                </td>
                                <td className="text-center px-4 py-3">
                                  {backfillStatus === "ok" && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">OK</span>}
                                  {backfillStatus === "pending" && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Pending</span>}
                                  {backfillStatus === "—" && <span className="text-slate-400">—</span>}
                                </td>
                                <td className="text-center px-4 py-3">
                                  {syncStatus === "ok" && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">OK</span>}
                                  {syncStatus === "pending" && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Pending</span>}
                                  {syncStatus === "error" && <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Error</span>}
                                  {syncStatus === "—" && <span className="text-slate-400">—</span>}
                                </td>
                                <td className="text-right tabular-nums text-slate-700 px-4 py-3">
                                  {t.payout_count != null ? `${t.payout_count} ($${Number(t.total_payout_usd ?? 0).toLocaleString()})` : "—"}
                                </td>
                                <td className="max-w-[220px] px-4 py-3">
                                  {t.sync_error ? (
                                    <span className="text-red-600 text-xs truncate block" title={t.sync_error}>
                                      {t.sync_error}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {(!data.traders.traders || data.traders.traders.length === 0) && (
                      <div className="p-8 text-center text-slate-500 text-sm">No profiles yet.</div>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {data?.alerts && activeTab === "system" && (
          <section className="mb-8">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900 mb-2">Critical email alerts</h2>
              </div>
              <div className="p-6">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">Status</span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${data.alerts.status === "enabled" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
                    >
                      {data.alerts.status === "enabled" ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">Recipient</span>
                    <span className="font-mono text-sm text-slate-700">
                      {data.alerts.recipient ?? "Not set"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500">Resend</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${data.alerts.resendConfigured ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                      {data.alerts.resendConfigured ? "Configured" : "Not set"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={sendTestAlert}
                      disabled={testAlertLoading || data.alerts.status !== "enabled"}
                      className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {testAlertLoading ? "Sending…" : "Send test alert"}
                    </button>
                    {testAlertResult === "sent" && (
                      <span className="text-sm text-emerald-600">Test email sent.</span>
                    )}
                    {testAlertResult && testAlertResult !== "sent" && (
                      <span className="text-sm text-red-600">{testAlertResult}</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  Critical checks (file ≥10 MB, Arbiscan ≥95%, DB failure) send an email here (throttled 1h). Set ALERT_EMAIL or ALERTS_TO and RESEND_API_KEY to enable.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Intelligence pipeline alerts (TICKET-014) — green OK, yellow warning, red critical */}
        {data && activeTab === "system" && (data.trustpilotScraper?.firms?.length > 0 || data.classifyReviews != null) && (
          <section className="mb-8">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900 mb-2">Intelligence pipeline alerts</h2>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-500 mb-3">
                  When a condition is triggered, an email is sent to the alert recipient (throttled 4h per condition).
                </p>
                <div className="flex flex-wrap gap-3">
                  {data.trustpilotScraper?.firms?.length > 0 && (() => {
                    const timestamps = data.trustpilotScraper.firms.map((f) => f.last_scraper_run_at).filter(Boolean);
                    const lastRun = timestamps.length ? new Date(Math.max(...timestamps.map((t) => new Date(t).getTime()))) : null;
                    const hoursSince = lastRun ? (Date.now() - lastRun.getTime()) / (1000 * 60 * 60) : Infinity;
                    const critical = !lastRun;
                    const warning = lastRun && hoursSince > 25;
                    const status = critical ? "critical" : warning ? "warning" : "ok";
                    const bgClass =
                      status === "ok"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : status === "warning"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
                    const label =
                      status === "ok"
                        ? `Scraper: OK (last run ${hoursSince.toFixed(0)}h ago)`
                        : status === "warning"
                          ? `Scraper: stale (last run ${hoursSince.toFixed(0)}h ago)`
                          : "Scraper: critical (never run)";
                    return (
                      <span
                        key="scraper"
                        className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium ${bgClass}`}
                      >
                        {label}
                      </span>
                    );
                  })()}
                  {data.classifyReviews != null && (() => {
                    const u = data.classifyReviews.unclassified ?? 0;
                    const critical = u > 1000;
                    const warning = u > 500 && u <= 1000;
                    const status = critical ? "critical" : warning ? "warning" : "ok";
                    const bgClass =
                      status === "ok"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : status === "warning"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
                    const label =
                      status === "ok"
                        ? `Classifier: OK (${u} unclassified)`
                        : status === "warning"
                          ? `Classifier: backlog (${u} unclassified, threshold 500)`
                          : `Classifier: critical (${u} unclassified)`;
                    return (
                      <span
                        key="classifier"
                        className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium ${bgClass}`}
                      >
                        {label}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          </section>
        )}

        {data?.checks && activeTab === "system" && (
          <section className="mb-8">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900 mb-2">Verification checks</h2>
              </div>
              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80">
                        <th className="text-left font-semibold text-slate-700 px-4 py-3">Check</th>
                        <th className="text-left font-semibold text-slate-700 px-4 py-3 w-28">Status</th>
                        <th className="text-right font-semibold text-slate-700 px-4 py-3 w-40">Where to look</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.checks.config || {}).map(([key, c]) => (
                        <tr key={key} className="border-b border-slate-100">
                          <td className="px-4 py-3 text-slate-700">{c.label}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.set ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                              {c.set ? "Set" : "Not set"}
                            </span>
                          </td>
                          <td className="text-right text-slate-500 text-xs px-4 py-3">—</td>
                        </tr>
                      ))}
                      <tr className="border-b border-slate-100">
                        <td className="px-4 py-3 text-slate-700">{data.checks.fileSize?.label ?? "File size"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              data.checks.fileSize?.status === "critical"
                                ? "bg-red-100 text-red-800"
                                : data.checks.fileSize?.status === "warning"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {data.checks.fileSize?.status ?? "—"}
                          </span>
                          {data.checks.fileSize?.maxFileBytes != null && data.checks.fileSize.maxFileBytes > 0 && (
                            <span className="ml-1 text-xs text-slate-500">{formatBytes(data.checks.fileSize.maxFileBytes)}</span>
                          )}
                        </td>
                        <td className="text-right px-4 py-3">
                          <button type="button" onClick={() => setActiveTab("payouts")} className="text-slate-600 hover:text-slate-900 text-xs font-medium">
                            Payouts → files
                          </button>
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-4 py-3 text-slate-700">{data.checks.arbiscan?.label ?? "Arbiscan"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              data.checks.arbiscan?.status === "critical"
                                ? "bg-red-100 text-red-800"
                                : data.checks.arbiscan?.status === "warning"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {data.checks.arbiscan?.status ?? "—"}
                          </span>
                          {data.checks.arbiscan?.percentage != null && (
                            <span className="ml-1 text-xs text-slate-600">{data.checks.arbiscan.percentage}%</span>
                          )}
                        </td>
                        <td className="text-right px-4 py-3">
                          <button type="button" onClick={() => setActiveTab("payouts")} className="text-slate-600 hover:text-slate-900 text-xs font-medium">
                            Payouts → Arbiscan
                          </button>
                        </td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-4 py-3 text-slate-700">{data.checks.supabase?.label ?? "Database"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${data.checks.supabase?.status === "critical" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
                            {data.checks.supabase?.status ?? "—"}
                          </span>
                          {data.checks.supabase?.latencyMs != null && (
                            <span className="ml-1 text-xs text-slate-600">{data.checks.supabase.latencyMs} ms</span>
                          )}
                        </td>
                        <td className="text-right text-slate-500 text-xs px-4 py-3">This tab (below)</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-4 py-3 text-slate-700">{data.checks.cacheConfigured?.label ?? "Cache"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${data.checks.cacheConfigured?.set ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                            {data.checks.cacheConfigured?.set ? "Configured" : "Not set"}
                          </span>
                        </td>
                        <td className="text-right text-slate-500 text-xs px-4 py-3">This tab (below)</td>
                      </tr>
                      {data.checks.propfirmsData && (
                        <tr className="border-b border-slate-100">
                          <td className="px-4 py-3 text-slate-700">{data.checks.propfirmsData.label ?? "Prop firms payout data"}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                data.checks.propfirmsData.status === "critical"
                                  ? "bg-red-100 text-red-800"
                                  : data.checks.propfirmsData.status === "warning"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {data.checks.propfirmsData.status ?? "ok"}
                            </span>
                            {data.checks.propfirmsData.firmsWithIssues?.length > 0 && (
                              <span className="ml-1 text-xs text-slate-500">
                                {data.checks.propfirmsData.firmsWithIssues.length} firm(s)
                              </span>
                            )}
                          </td>
                          <td className="text-right px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setActiveTab("payouts")}
                              className="text-slate-600 hover:text-slate-900 text-xs font-medium"
                            >
                              View in Payouts tab →
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {data && activeTab === "payouts" && (
          <div className="space-y-8">
            {/* Prop firms payout data – chart table: cols = firms, rows = time ranges */}
            {data.propfirmsData ? (
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h2 className="text-lg font-semibold text-slate-900 mb-2">Prop firms payout data</h2>
                </div>
                <div className="p-6">
                    {!data.propfirmsData.firmsWithIssues?.length ? (
                      <p className="text-slate-600">No prop firms with payout data issues.</p>
                    ) : (
                      <>
                        {/* Summary: counts + why only these firms + top 3 messages */}
                        {(() => {
                          const issues = data.propfirmsData.firmsWithIssues;
                          const critical = issues.filter((f) => f.status === "critical").length;
                          const warning = issues.filter((f) => f.status === "warning").length;
                          const allMessages = issues.flatMap((f) => (f.flags || []).map((flag) => ({ firm: f.firmName ?? f.firmId, message: flag.message })));
                          const top3 = allMessages.slice(0, 3);
                          return (
                            <div className="mb-4 space-y-3">
                              <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-slate-100">
                                <span className="font-medium">
                                  {issues.length} firm(s) with issues below — all other firms are ok.
                                </span>
                                {critical > 0 && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">{critical} critical</span>
                                )}
                                {warning > 0 && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">{warning} warning</span>
                                )}
                              </div>
                              {top3.length > 0 && (
                                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                                  <div className="text-sm font-medium text-slate-700 mb-1">What&apos;s wrong (top 3):</div>
                                  <ol className="list-decimal list-inside text-sm text-slate-600 space-y-0.5">
                                    {top3.map((item, i) => (
                                      <li key={i}>
                                        <span className="font-medium text-slate-800">{item.firm}:</span> {item.message}
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        {/* Table: rows = 24h, 7d, 30d; columns = firms */}
                        <div className="overflow-x-auto relative">
                          <table className="table table-sm w-full">
                            <thead>
                              <tr>
                                <th className="w-20 sticky left-0 bg-white z-10">Period</th>
                                {data.propfirmsData.firmsWithIssues.map((f) => (
                                  <th key={f.firmId} className="text-center min-w-[100px] font-medium">
                                    {f.firmName ?? f.firmId}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {["24h", "7d", "30d"].map((period) => (
                                <tr key={period}>
                                  <td className="sticky left-0 bg-white z-10 font-medium">{period}</td>
                                  {data.propfirmsData.firmsWithIssues.map((f) => {
                                    const cellStatus = f.statusByPeriod?.[period] ?? "ok";
                                    const messages = f.messagesByPeriod?.[period] ?? [];
                                    const count = f.counts?.[period];
                                    const hasTip = messages.length > 0;
                                    return (
                                      <td
                                        key={f.firmId}
                                        className="p-1 text-center align-middle"
                                        onMouseEnter={() =>
                                          hasTip
                                            ? setPropfirmsTooltip({
                                                firmName: f.firmName ?? f.firmId,
                                                period,
                                                messages,
                                                count,
                                              })
                                            : setPropfirmsTooltip(null)
                                        }
                                        onMouseLeave={() => setPropfirmsTooltip(null)}
                                      >
                                        <div
                                          className={`inline-flex items-center justify-center min-w-[72px] min-h-[32px] rounded cursor-default ${
                                            cellStatus === "critical"
                                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-300 dark:border-red-700"
                                              : cellStatus === "warning"
                                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                                                : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-300 dark:border-green-700"
                                          }`}
                                        >
                                          {cellStatus === "ok" ? "ok" : cellStatus}
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {/* Visible hover tooltip (below table so it never clips) */}
                        {propfirmsTooltip && (
                          <div
                            className="mt-3 p-3 rounded-lg shadow-lg border border-slate-200 bg-white text-left text-sm"
                            role="tooltip"
                          >
                            <div className="font-medium text-slate-900">
                              {propfirmsTooltip.firmName} ({propfirmsTooltip.period})
                              {propfirmsTooltip.count != null && (
                                <span className="ml-2 text-slate-500">Count: {propfirmsTooltip.count}</span>
                              )}
                            </div>
                            <p className="text-slate-600 mt-1">Why this is warning/critical:</p>
                            <ul className="list-disc list-inside mt-0.5 text-slate-700 space-y-0.5">
                              {propfirmsTooltip.messages.map((msg, i) => (
                                <li key={i}>{msg}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <p className="text-xs text-slate-500 mt-3">
                          Each column is a firm; rows are time ranges. Green = ok, yellow = warning, red = critical. Hover a yellow or red cell to see why.
                        </p>
                      </>
                    )}
                </div>
              </section>
            ) : null}
            {/* Arbiscan */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Arbiscan API</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Calls today</div>
                  <div className="text-2xl font-bold mt-1" style={{ color: "#635BFF" }}>{data.arbiscan?.calls ?? "—"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Daily limit</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{data.arbiscan?.limit ?? "—"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Usage %</div>
                  <div className={`text-2xl font-bold mt-1 ${(data.arbiscan?.percentage ?? 0) >= 80 ? "text-red-600" : "text-slate-900"}`}>
                    {data.arbiscan?.percentage != null ? `${data.arbiscan.percentage}%` : "—"}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Count is per process (in-memory). On serverless, this often shows 0 because the instance serving this page may not have made any Arbiscan requests today. Sync/cron runs that call Arbiscan run in other instances.
              </p>
            </section>
            {/* Payout files */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Payout files (data/propfirms)</h2>
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                <div className="p-6">
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <span className="text-slate-500">Total size: </span>
                      <strong>{data.files?.totalMB != null ? `${data.files.totalMB} MB` : "—"}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Files: </span>
                      <strong>{data.files?.totalFiles ?? "—"}</strong>
                    </div>
                  </div>
                  {data.files?.error && (
                    <p className="text-red-600 text-sm mt-2">{data.files.error}</p>
                  )}
                  {data.files?.largest?.length > 0 && (
                    <div className="overflow-x-auto mt-4">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th>Path</th>
                            <th>Size</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.files.largest.map((f) => (
                            <tr key={f.path}>
                              <td className="font-mono text-xs">{f.path}</td>
                              <td>{formatBytes(f.bytes)}</td>
                              <td>{f.over5MB ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">&gt;5MB</span> : null}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {data && activeTab === "daily2" && (
          <div className="space-y-8">
            {/* Daily 2: Classify */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Daily 2 – Classify</h2>
              <p className="text-sm text-slate-500 mb-3">
                Classify unclassified Trustpilot reviews via OpenAI (batch of 20 per API call). Run a limited batch here or use the cron script.
              </p>
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6">
                  <div className="flex flex-wrap items-end gap-4 mb-4">
                    <div>
                      <span className="text-slate-500 text-sm block">Last run</span>
                      <p className="font-mono text-sm">
                        {classifyStatus?.lastClassifiedAt
                          ? new Date(classifyStatus.lastClassifiedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-sm block">Total reviews</span>
                      <p className="font-semibold text-lg">{classifyStatus?.totalReviews ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-sm block">Classified</span>
                      <p className="font-semibold text-lg text-emerald-600">{classifyStatus?.classifiedCount ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 text-sm block">Unclassified</span>
                      <p className="font-semibold text-lg">{classifyStatus?.unclassifiedCount ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <label className="label gap-2">
                        <span className="label-text text-sm">Limit</span>
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          value={classifyLimit}
                          onChange={(e) => setClassifyLimit(Math.max(1, Math.min(1000, parseInt(e.target.value, 10) || 40)))}
                          className="input input-bordered input-sm w-20"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={runClassify}
                        disabled={classifyRunLoading || (classifyStatus?.unclassifiedCount === 0)}
                        className="px-4 py-2 text-white rounded-lg font-semibold text-sm"
                        style={{ backgroundColor: "#635BFF" }}
                      >
                        {classifyRunLoading ? "Running…" : `Classify next ${classifyLimit}`}
                      </button>
                    </div>
                  </div>
                  {classifyRunResult && (
                    <div className="border-t border-slate-200 pt-4 mt-2">
                      {classifyRunResult.error ? (
                        <p className="text-red-600 text-sm">{classifyRunResult.error}</p>
                      ) : (
                        <>
                          <p className="font-medium text-slate-900 mb-2">Last run result</p>
                          <div className="flex flex-wrap gap-4 text-sm mb-2">
                            <span><strong>Processed:</strong> {classifyRunResult.totalProcessed ?? 0} (limit {classifyRunResult.limit ?? 0})</span>
                            <span className="text-emerald-600"><strong>Classified:</strong> {classifyRunResult.classified ?? 0}</span>
                            <span className={classifyRunResult.failed > 0 ? "text-amber-600" : ""}><strong>Failed:</strong> {classifyRunResult.failed ?? 0}</span>
                            <span className="text-slate-600"><strong>Unclassified remaining:</strong> {classifyRunResult.unclassifiedRemaining ?? "—"}</span>
                            {classifyRunResult.durationMs != null && (
                              <span className="text-slate-500">({(classifyRunResult.durationMs / 1000).toFixed(1)}s)</span>
                            )}
                          </div>
                          <p className="text-slate-600 text-sm">
                            {classifyRunResult.classified ?? 0} classified; {(classifyRunResult.unclassifiedRemaining ?? 0)} not run; {classifyRunResult.failed ?? 0} failed.
                          </p>
                          {classifyRunResult.errors?.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-slate-600 mb-1">Failure reasons:</p>
                              <ul className="list-disc list-inside text-xs text-amber-600 space-y-0.5">
                                {classifyRunResult.errors.slice(0, 10).map((msg, i) => (
                                  <li key={i}>{msg}</li>
                                ))}
                                {classifyRunResult.errors.length > 10 && (
                                  <li>… and {classifyRunResult.errors.length - 10} more</li>
                                )}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {data && activeTab === "daily3" && (
          <div className="space-y-8">
            {data.incidentDetection ? (
            <section>
                <h2 className="text-lg font-semibold mb-4">Daily 3 – Incidents</h2>
                <p className="text-sm text-slate-500 mb-3">
                  {data.incidentDetection.note ?? 'Run daily at 5 AM PST (13:00 UTC), 1 hour after classifier. Pipeline: scrape → classify → incidents.'}
                </p>
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-6">
                    <div className="flex flex-wrap items-end gap-6 mb-3">
                      <div>
                        <span className="text-slate-500 text-sm block">Last run</span>
                        <p className="font-mono text-sm">
                          {data.incidentDetection.lastRunAt
                            ? new Date(data.incidentDetection.lastRunAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-sm block">Current week</span>
                        <p className="font-semibold">{data.incidentDetection.currentWeek?.weekLabel ?? "—"}</p>
                      </div>
                    </div>
                    {data.incidentDetection.firms?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="table table-sm w-full">
                          <thead>
                            <tr>
                              <th className="font-medium">Firm</th>
                              <th className="text-right font-medium">Incidents (this week)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.incidentDetection.firms
                              .sort((a, b) => (a.firmName || a.firmId).localeCompare(b.firmName || b.firmId))
                              .map((f) => (
                                <tr key={f.firmId}>
                                  <td className="font-medium">{f.firmName ?? f.firmId}</td>
                                  <td className="text-right tabular-nums">{f.incidentCount ?? 0}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500 text-sm">No firms with Trustpilot or no data.</p>
                    )}
                  </div>
                </div>
              </section>
            ) : (
              <p className="text-slate-500">No incident detection data. Run daily-step3-sync-firm-incidents workflow.</p>
            )}
          </div>
        )}

        {data && activeTab === "weekly1" && (
          <div className="space-y-8">
            {/* Weekly 1: Generate weekly reports – monitoring */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Weekly 1 – Generate reports</h2>
              <p className="text-sm text-slate-500 mb-3">
                Populates <code className="text-xs bg-slate-100 px-1 rounded">firm_weekly_reports</code> for current week (Mon–Sun UTC). Runs Sunday 7:00 UTC (weekly-step1-generate-firm-weekly-reports). Weekly 2 (digest send) uses this data.
              </p>
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6">
                  {data.generateWeeklyReportsRun ? (
                    <>
                      <p className="text-xs text-slate-500 mb-3">{data.generateWeeklyReportsRun.note}</p>
                      <div className="flex flex-wrap gap-4 items-baseline">
                        {data.generateWeeklyReportsRun.lastRunAt ? (
                          <>
                            <div>
                              <span className="text-slate-500 text-sm">Last run</span>
                              <p className="font-mono text-sm">
                                {new Date(data.generateWeeklyReportsRun.lastRunAt).toLocaleString(undefined, {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </p>
                            </div>
                            <div>
                              <span className="text-slate-500 text-sm">Week</span>
                              <p className="font-mono text-sm">{data.generateWeeklyReportsRun.weekLabel ?? "—"}</p>
                            </div>
                            {data.generateWeeklyReportsRun.weekStart && (
                              <div>
                                <span className="text-slate-500 text-sm">Range</span>
                                <p className="font-mono text-sm">{data.generateWeeklyReportsRun.weekStart} → {data.generateWeeklyReportsRun.weekEnd}</p>
                              </div>
                            )}
                            <div>
                              <span className="text-slate-500 text-sm">Firms processed</span>
                              <p className="font-semibold">{data.generateWeeklyReportsRun.firmsProcessed ?? "—"}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 text-sm">Success</span>
                              <p className="font-semibold text-emerald-600">{data.generateWeeklyReportsRun.successCount ?? "—"}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 text-sm">Errors</span>
                              <p className="font-semibold text-red-600">{data.generateWeeklyReportsRun.errorCount ?? "—"}</p>
                            </div>
                            {data.generateWeeklyReportsRun.durationMs != null && (
                              <div>
                                <span className="text-slate-500 text-sm">Duration</span>
                                <p className="font-mono text-sm">{Math.round(data.generateWeeklyReportsRun.durationMs / 1000)}s</p>
                              </div>
                            )}
                            {Array.isArray(data.generateWeeklyReportsRun.errors) && data.generateWeeklyReportsRun.errors.length > 0 && (
                              <div className="w-full">
                                <span className="text-slate-500 text-sm">Errors (sample)</span>
                                <ul className="list-disc list-inside text-xs text-red-600 mt-0.5 max-h-24 overflow-y-auto">
                                  {data.generateWeeklyReportsRun.errors.slice(0, 5).map((msg, i) => (
                                    <li key={i}>{String(msg)}</li>
                                  ))}
                                  {data.generateWeeklyReportsRun.errors.length > 5 && (
                                    <li>… and {data.generateWeeklyReportsRun.errors.length - 5} more</li>
                                  )}
                                </ul>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-slate-500 text-sm">No run recorded yet. Trigger weekly-step1-generate-firm-weekly-reports to populate.</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-slate-500 text-sm">No run recorded yet. Trigger weekly-step1-generate-firm-weekly-reports to populate.</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {data && activeTab === "weekly2" && (
          <div className="space-y-8">
            {/* Intelligence feed (weekly reports + digest readiness) */}
            {data.intelligenceFeed && (
              <section>
                <h2 className="text-lg font-semibold mb-4">Intelligence feed</h2>
                <p className="text-sm text-slate-500 mb-3">
                  Weekly reports and digest readiness. Digest uses <code className="text-xs bg-slate-100 px-1 rounded">firm_weekly_reports</code> for current week (Mon–Sun UTC); missing reports = gaps in emails.
                </p>
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-6">
                    <div className="flex flex-wrap gap-6 mb-4">
                      <div>
                        <span className="text-slate-500 text-sm">Subscriptions</span>
                        <p className="font-semibold">{data.intelligenceFeed.subscriptionsTotal ?? 0}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-sm">Email enabled</span>
                        <p className="font-semibold">{data.intelligenceFeed.subscriptionsEmailEnabled ?? 0}</p>
                      </div>
                      <div>
                        <span className="text-slate-500 text-sm">Last week ({data.intelligenceFeed.weekLabel ?? "—"})</span>
                        <p className="font-semibold">
                          {(data.intelligenceFeed.lastWeek?.firmsWithReport ?? 0)} / {(data.intelligenceFeed.lastWeek?.firmsExpected ?? 0)} firms have report
                        </p>
                      </div>
                    </div>
                    {(data.intelligenceFeed.lastWeek?.firmIdsWithReport?.length > 0 || data.intelligenceFeed.lastWeek?.firmIdsWithoutReport?.length > 0) && (
                      <div className="overflow-x-auto">
                        <table className="table table-sm w-full">
                          <thead>
                            <tr>
                              <th className="font-medium">Firm</th>
                              <th className="text-right font-medium">Last week report</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              ...(data.intelligenceFeed.lastWeek.firmIdsWithReport || []).map((f) => ({ ...f, hasReport: true })),
                              ...(data.intelligenceFeed.lastWeek.firmIdsWithoutReport || []).map((f) => ({ ...f, hasReport: false })),
                            ]
                              .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
                              .map((f) => (
                                <tr key={f.id}>
                                  <td className="font-medium">{f.name ?? f.id}</td>
                                  <td className="text-right">
                                    {f.hasReport ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">OK</span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Missing</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {(!data.intelligenceFeed.lastWeek?.firmIdsWithReport?.length && !data.intelligenceFeed.lastWeek?.firmIdsWithoutReport?.length) && (
                      <p className="text-slate-500 text-sm">No firms with Trustpilot URL, or no data for last week.</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Weekly 2: Email send – last run from weekly-step2-send-firm-weekly-reports */}
            <section>
                <h2 className="text-lg font-semibold mb-4">Weekly 2 – Email send</h2>
                <p className="text-sm text-slate-500 mb-3">
                  Sends digest emails to subscribers via Resend. Runs Sunday 8:00 UTC (weekly-step2-send-firm-weekly-reports). Uses <code className="text-xs bg-slate-100 px-1 rounded">firm_weekly_reports</code> from Weekly 1.
                </p>
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-6">
                    {data.weeklyEmailReport ? (
                      <>
                        <p className="text-xs text-slate-500 mb-3">{data.weeklyEmailReport.note}</p>
                        <div className="flex flex-wrap gap-4 items-baseline">
                          {data.weeklyEmailReport.lastRunAt ? (
                            <>
                              <div>
                                <span className="text-slate-500 text-sm">Last run</span>
                                <p className="font-mono text-sm">
                                  {new Date(data.weeklyEmailReport.lastRunAt).toLocaleString(undefined, {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })}
                                </p>
                              </div>
                              {data.weeklyEmailReport.weekStart && (
                                <div>
                                  <span className="text-slate-500 text-sm">Week</span>
                                  <p className="font-mono text-sm">
                                    {data.weeklyEmailReport.weekStart} → {data.weeklyEmailReport.weekEnd}
                                  </p>
                                </div>
                              )}
                              <div>
                                <span className="text-slate-500 text-sm">Sent</span>
                                <p className="font-semibold text-emerald-600">{data.weeklyEmailReport.sent ?? "—"}</p>
                              </div>
                              <div>
                                <span className="text-slate-500 text-sm">Failed</span>
                                <p className="font-semibold text-red-600">{data.weeklyEmailReport.failed ?? "—"}</p>
                              </div>
                              <div>
                                <span className="text-slate-500 text-sm">Skipped</span>
                                <p className="font-semibold text-slate-600">{data.weeklyEmailReport.skipped ?? "—"}</p>
                              </div>
                              {Array.isArray(data.weeklyEmailReport.errors) && data.weeklyEmailReport.errors.length > 0 && (
                                <div className="w-full">
                                  <span className="text-slate-500 text-sm">Errors (sample)</span>
                                  <ul className="list-disc list-inside text-xs text-red-600 mt-0.5 max-h-24 overflow-y-auto">
                                    {data.weeklyEmailReport.errors.slice(0, 5).map((msg, i) => (
                                      <li key={i}>{String(msg)}</li>
                                    ))}
                                    {data.weeklyEmailReport.errors.length > 5 && (
                                      <li>… and {data.weeklyEmailReport.errors.length - 5} more</li>
                                    )}
                                  </ul>
                                </div>
                              )}
                            </>
                          ) : (
                            <p className="text-slate-500 text-sm">No run recorded yet. Trigger weekly-step2-send-firm-weekly-reports to populate.</p>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-slate-500 text-sm">Metrics loading… Refresh if this persists. Ensure migration 21_cron_last_run.sql is applied.</p>
                    )}
                  </div>
                </div>
              </section>
            </div>
        )}

        {data && activeTab === "daily1" && (
          <div className="space-y-8">
            {data.trustpilotScraper?.firms?.length > 0 ? (
            <section>
                <h2 className="text-lg font-semibold mb-4">Daily 1 – Scrape</h2>
                <p className="text-sm text-slate-500 mb-3">
                  Trustpilot scraping. Daily run via GitHub Actions (daily-step1-sync-firm-trustpilot-reviews). Last run per firm below.
                </p>
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="table table-sm w-full">
                      <thead>
                        <tr>
                          <th className="font-medium">Firm</th>
                          <th className="text-right">Last run</th>
                          <th className="text-right">Scraped</th>
                          <th className="text-right">Stored</th>
                          <th className="text-right">Duplicates</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.trustpilotScraper.firms.map((f) => (
                          <tr key={f.id}>
                            <td className="font-medium">{f.name ?? f.id}</td>
                            <td className="text-right text-slate-600 tabular-nums">
                              {f.last_scraper_run_at
                                ? new Date(f.last_scraper_run_at).toLocaleString(undefined, {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })
                                : "—"}
                            </td>
                            <td className="text-right tabular-nums">{f.last_scraper_reviews_scraped ?? "—"}</td>
                            <td className="text-right tabular-nums">{f.last_scraper_reviews_stored ?? "—"}</td>
                            <td className="text-right tabular-nums">{f.last_scraper_duplicates_skipped ?? "—"}</td>
                            <td>
                              {f.last_scraper_error ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800" title={f.last_scraper_error}>
                                  Error
                                </span>
                              ) : f.last_scraper_run_at ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">OK</span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {data.trustpilotScraper.firms.some((f) => f.last_scraper_error) && (
                    <div className="px-4 pb-3 pt-1 border-t border-slate-200">
                      <p className="text-xs font-medium text-slate-600 mb-1">Errors (hover badge for message):</p>
                      <ul className="text-xs text-slate-500 space-y-0.5">
                        {data.trustpilotScraper.firms
                          .filter((f) => f.last_scraper_error)
                          .map((f) => (
                            <li key={f.id}>
                              <span className="font-medium">{f.name ?? f.id}:</span> {f.last_scraper_error}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <p className="text-slate-500">No firms with Trustpilot URL. Configure firms to see scraper runs.</p>
            )}
          </div>
        )}

        {data && activeTab === "system" && (
          <div className="space-y-8">
            {/* Database */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Database (row counts)</h2>
              <div className="overflow-x-auto">
                <table className="table table-sm table-border w-full max-w-md">
                  <thead>
                    <tr>
                      <th className="font-medium">Table</th>
                      <th className="text-right font-medium">Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.database &&
                      Object.entries(data.database).map(([table, count]) => (
                        <tr key={table}>
                          <td className="font-mono text-sm">{table}</td>
                          <td className="text-right tabular-nums">{count != null ? count.toLocaleString() : "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Cache */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Cache (since process start)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Hits</div>
                  <div className="text-2xl font-bold text-slate-700 mt-1">{data.cache?.hits ?? "—"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Misses</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{data.cache?.misses ?? "—"}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Hit rate</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">
                    {data.cache?.hitRate != null ? `${(data.cache.hitRate * 100).toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>
            </section>

            {/* API latency / errors note */}
            <section>
              <h2 className="text-lg font-semibold mb-4">API latency & error rates</h2>
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                <div className="p-6">
                  <p className="text-slate-700">
                    {data.apiLatency?.note ?? "See Vercel Analytics for P50/P95/P99 by route."}
                  </p>
                  <p className="text-slate-700 mt-2">
                    {data.errorRates?.note ?? "See Vercel Analytics or logs for error rates by endpoint."}
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
