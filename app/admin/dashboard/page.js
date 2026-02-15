"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/common/AdminLayout";

const REFRESH_MS = 30_000;

function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${n} B`;
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
        <div className="max-w-6xl mx-auto py-12 px-4 flex items-center justify-center">
          <span className="loading loading-spinner loading-lg text-primary" />
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
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-base-content">Dashboard</h1>
            <p className="text-sm text-base-content/60 mt-1">Monitoring &amp; alerts in one place</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchMetrics}
              className="btn btn-sm btn-ghost"
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh now"}
            </button>
            <button type="button" onClick={exportCSV} className="btn btn-sm btn-primary" disabled={!data}>
              Export CSV
            </button>
          </div>
        </div>
        <p className="text-sm text-base-content/60 mb-6">
          Auto-refresh every {REFRESH_MS / 1000}s. Last fetched: {data?.fetchedAt ? new Date(data.fetchedAt).toLocaleString() : "—"}
        </p>

        {error && (
          <div className="alert alert-error mb-6">
            <span>{error}</span>
          </div>
        )}

        {!data && !loading && (
          <div className="text-base-content/70">No metrics available.</div>
        )}

        {data?.alerts && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Critical email alerts</h2>
            <div className="card card-border bg-base-100 shadow">
              <div className="card-body">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-base-content/70">Status</span>
                    <span
                      className={`badge ${data.alerts.status === "enabled" ? "badge-success" : "badge-warning"}`}
                    >
                      {data.alerts.status === "enabled" ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-base-content/70">Recipient</span>
                    <span className="font-mono text-sm">
                      {data.alerts.recipient ?? "Not set"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-base-content/70">Resend</span>
                    <span className={`badge ${data.alerts.resendConfigured ? "badge-success" : "badge-ghost"}`}>
                      {data.alerts.resendConfigured ? "Configured" : "Not set"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={sendTestAlert}
                      disabled={testAlertLoading || data.alerts.status !== "enabled"}
                      className="btn btn-sm btn-outline"
                    >
                      {testAlertLoading ? "Sending…" : "Send test alert"}
                    </button>
                    {testAlertResult === "sent" && (
                      <span className="text-sm text-success">Test email sent.</span>
                    )}
                    {testAlertResult && testAlertResult !== "sent" && (
                      <span className="text-sm text-error">{testAlertResult}</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-base-content/50 mt-3">
                  Critical checks (file ≥10 MB, Arbiscan ≥95%, DB failure) send an email here (throttled 1h). Set ALERT_EMAIL or ALERTS_TO and RESEND_API_KEY to enable.
                </p>
              </div>
            </div>
          </section>
        )}

        {data?.checks && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4">Verification checks</h2>
            <div className="card card-border bg-base-100 shadow">
              <div className="card-body">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(data.checks.config || {}).map(([key, c]) => (
                    <div key={key} className="flex items-center justify-between gap-2">
                      <span className="text-sm">{c.label}</span>
                      <span className={`badge ${c.set ? "badge-success" : "badge-ghost"}`}>
                        {c.set ? "Set" : "Not set"}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="divider my-2" />
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{data.checks.fileSize?.label ?? "File size"}</span>
                    <span
                      className={`badge ${
                        data.checks.fileSize?.status === "critical"
                          ? "badge-error"
                          : data.checks.fileSize?.status === "warning"
                            ? "badge-warning"
                            : "badge-success"
                      }`}
                    >
                      {data.checks.fileSize?.status ?? "—"}
                    </span>
                    {data.checks.fileSize?.maxFileBytes != null && data.checks.fileSize.maxFileBytes > 0 && (
                      <span className="text-xs text-base-content/60">
                        max {formatBytes(data.checks.fileSize.maxFileBytes)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{data.checks.arbiscan?.label ?? "Arbiscan"}</span>
                    <span
                      className={`badge ${
                        data.checks.arbiscan?.status === "critical"
                          ? "badge-error"
                          : data.checks.arbiscan?.status === "warning"
                            ? "badge-warning"
                            : "badge-success"
                      }`}
                    >
                      {data.checks.arbiscan?.status ?? "—"}
                    </span>
                    {data.checks.arbiscan?.percentage != null && (
                      <span className="text-xs text-base-content/60">{data.checks.arbiscan.percentage}%</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{data.checks.supabase?.label ?? "Database"}</span>
                    <span
                      className={`badge ${
                        data.checks.supabase?.status === "critical" ? "badge-error" : "badge-success"
                      }`}
                    >
                      {data.checks.supabase?.status ?? "—"}
                    </span>
                    {data.checks.supabase?.latencyMs != null && (
                      <span className="text-xs text-base-content/60">{data.checks.supabase.latencyMs} ms</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{data.checks.cacheConfigured?.label ?? "Cache"}</span>
                    <span className={`badge ${data.checks.cacheConfigured?.set ? "badge-success" : "badge-ghost"}`}>
                      {data.checks.cacheConfigured?.set ? "Configured" : "Not set"}
                    </span>
                  </div>
                  {data.checks.propfirmsData && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{data.checks.propfirmsData.label ?? "Prop firms data"}</span>
                      <span
                        className={`badge ${
                          data.checks.propfirmsData.status === "critical"
                            ? "badge-error"
                            : data.checks.propfirmsData.status === "warning"
                              ? "badge-warning"
                              : "badge-success"
                        }`}
                      >
                        {data.checks.propfirmsData.status ?? "ok"}
                      </span>
                      {data.checks.propfirmsData.firmsWithIssues?.length > 0 && (
                        <span className="text-xs text-base-content/60">
                          {data.checks.propfirmsData.firmsWithIssues.length} firm(s) with issues
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {data && (
          <div className="space-y-8">
            {/* Prop firms payout data – chart table: cols = firms, rows = time ranges */}
            {data.propfirmsData && (
              <section>
                <h2 className="text-lg font-semibold mb-4">Prop firms payout data</h2>
                <div className="card card-border bg-base-100 shadow">
                  <div className="card-body">
                    {!data.propfirmsData.firmsWithIssues?.length ? (
                      <p className="text-base-content/70">No prop firms with payout data issues.</p>
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
                              <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-base-200/60">
                                <span className="font-medium">
                                  {issues.length} firm(s) with issues below — all other firms are ok.
                                </span>
                                {critical > 0 && (
                                  <span className="badge badge-error badge-sm">{critical} critical</span>
                                )}
                                {warning > 0 && (
                                  <span className="badge badge-warning badge-sm">{warning} warning</span>
                                )}
                              </div>
                              {top3.length > 0 && (
                                <div className="p-3 rounded-lg border border-base-300 bg-base-200/40">
                                  <div className="text-sm font-medium text-base-content/80 mb-1">What&apos;s wrong (top 3):</div>
                                  <ol className="list-decimal list-inside text-sm text-base-content/70 space-y-0.5">
                                    {top3.map((item, i) => (
                                      <li key={i}>
                                        <span className="font-medium text-base-content/90">{item.firm}:</span> {item.message}
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
                                <th className="w-20 sticky left-0 bg-base-100 z-10">Period</th>
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
                                  <td className="sticky left-0 bg-base-100 z-10 font-medium">{period}</td>
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
                            className="mt-3 p-3 rounded-lg shadow-lg border border-base-300 bg-base-100 text-left text-sm"
                            role="tooltip"
                          >
                            <div className="font-medium text-base-content">
                              {propfirmsTooltip.firmName} ({propfirmsTooltip.period})
                              {propfirmsTooltip.count != null && (
                                <span className="ml-2 text-base-content/60">Count: {propfirmsTooltip.count}</span>
                              )}
                            </div>
                            <p className="text-base-content/70 mt-1">Why this is warning/critical:</p>
                            <ul className="list-disc list-inside mt-0.5 text-base-content/80 space-y-0.5">
                              {propfirmsTooltip.messages.map((msg, i) => (
                                <li key={i}>{msg}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <p className="text-xs text-base-content/50 mt-3">
                          Each column is a firm; rows are time ranges. Green = ok, yellow = warning, red = critical. Hover a yellow or red cell to see why.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Review classification (Trustpilot) */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Review classification</h2>
              <p className="text-sm text-base-content/60 mb-3">
                Classify unclassified Trustpilot reviews via OpenAI (batch of 20 per API call). Run a limited batch here or use the cron script.
              </p>
              <div className="card card-border bg-base-100 shadow overflow-hidden">
                <div className="card-body">
                  <div className="flex flex-wrap items-end gap-4 mb-4">
                    <div>
                      <span className="text-base-content/60 text-sm block">Total reviews</span>
                      <p className="font-semibold text-lg">{classifyStatus?.totalReviews ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-base-content/60 text-sm block">Classified</span>
                      <p className="font-semibold text-lg text-success">{classifyStatus?.classifiedCount ?? "—"}</p>
                    </div>
                    <div>
                      <span className="text-base-content/60 text-sm block">Unclassified</span>
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
                        className="btn btn-primary btn-sm"
                      >
                        {classifyRunLoading ? "Running…" : `Classify next ${classifyLimit}`}
                      </button>
                    </div>
                  </div>
                  {classifyRunResult && (
                    <div className="border-t border-base-200 pt-4 mt-2">
                      {classifyRunResult.error ? (
                        <p className="text-error text-sm">{classifyRunResult.error}</p>
                      ) : (
                        <>
                          <p className="font-medium text-base-content mb-2">Last run result</p>
                          <div className="flex flex-wrap gap-4 text-sm mb-2">
                            <span><strong>Processed:</strong> {classifyRunResult.totalProcessed ?? 0} (limit {classifyRunResult.limit ?? 0})</span>
                            <span className="text-success"><strong>Classified:</strong> {classifyRunResult.classified ?? 0}</span>
                            <span className={classifyRunResult.failed > 0 ? "text-warning" : ""}><strong>Failed:</strong> {classifyRunResult.failed ?? 0}</span>
                            <span className="text-base-content/70"><strong>Unclassified remaining:</strong> {classifyRunResult.unclassifiedRemaining ?? "—"}</span>
                            {classifyRunResult.durationMs != null && (
                              <span className="text-base-content/60">({(classifyRunResult.durationMs / 1000).toFixed(1)}s)</span>
                            )}
                          </div>
                          <p className="text-base-content/70 text-sm">
                            {classifyRunResult.classified ?? 0} classified; {(classifyRunResult.unclassifiedRemaining ?? 0)} not run; {classifyRunResult.failed ?? 0} failed.
                          </p>
                          {classifyRunResult.errors?.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs font-medium text-base-content/70 mb-1">Failure reasons:</p>
                              <ul className="list-disc list-inside text-xs text-warning space-y-0.5">
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

            {/* Incident detection (daily, after classifier) */}
            {data.incidentDetection && (
              <section>
                <h2 className="text-lg font-semibold mb-4">Incident detection</h2>
                <p className="text-sm text-base-content/60 mb-3">
                  {data.incidentDetection.note ?? 'Run daily at 5 AM PST (13:00 UTC), 1 hour after classifier. Pipeline: scrape → classify → incidents.'}
                </p>
                <div className="card card-border bg-base-100 shadow overflow-hidden">
                  <div className="card-body">
                    <div className="mb-3">
                      <span className="text-base-content/60 text-sm">Current week</span>
                      <p className="font-semibold">{data.incidentDetection.currentWeek?.weekLabel ?? '—'}</p>
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
                      <p className="text-base-content/60 text-sm">No firms with Trustpilot or no data.</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Intelligence feed (weekly reports + digest) */}
            {data.intelligenceFeed && (
              <section>
                <h2 className="text-lg font-semibold mb-4">Intelligence feed</h2>
                <p className="text-sm text-base-content/60 mb-3">
                  Weekly reports and digest readiness. Digest uses <code className="text-xs bg-base-200 px-1 rounded">weekly_reports</code> for last week; missing reports = gaps in emails.
                </p>
                <div className="card card-border bg-base-100 shadow overflow-hidden">
                  <div className="card-body">
                    <div className="flex flex-wrap gap-6 mb-4">
                      <div>
                        <span className="text-base-content/60 text-sm">Subscriptions</span>
                        <p className="font-semibold">{data.intelligenceFeed.subscriptionsTotal ?? 0}</p>
                      </div>
                      <div>
                        <span className="text-base-content/60 text-sm">Email enabled</span>
                        <p className="font-semibold">{data.intelligenceFeed.subscriptionsEmailEnabled ?? 0}</p>
                      </div>
                      <div>
                        <span className="text-base-content/60 text-sm">Last week ({data.intelligenceFeed.weekLabel ?? "—"})</span>
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
                                      <span className="badge badge-success badge-sm">OK</span>
                                    ) : (
                                      <span className="badge badge-warning badge-sm">Missing</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {(!data.intelligenceFeed.lastWeek?.firmIdsWithReport?.length && !data.intelligenceFeed.lastWeek?.firmIdsWithoutReport?.length) && (
                      <p className="text-base-content/60 text-sm">No firms with Trustpilot URL, or no data for last week.</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Trustpilot scraping (daily GitHub Actions) */}
            {data.trustpilotScraper?.firms?.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4">Trustpilot scraping</h2>
                <p className="text-sm text-base-content/60 mb-3">
                  Daily run via GitHub Actions (sync-trustpilot-reviews). Last run per firm below.
                </p>
                <div className="card card-border bg-base-100 shadow overflow-hidden">
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
                            <td className="text-right text-base-content/70 tabular-nums">
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
                                <span className="badge badge-error badge-sm" title={f.last_scraper_error}>
                                  Error
                                </span>
                              ) : f.last_scraper_run_at ? (
                                <span className="badge badge-success badge-sm">OK</span>
                              ) : (
                                <span className="text-base-content/50">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {data.trustpilotScraper.firms.some((f) => f.last_scraper_error) && (
                    <div className="px-4 pb-3 pt-1 border-t border-base-200">
                      <p className="text-xs font-medium text-base-content/70 mb-1">Errors (hover badge for message):</p>
                      <ul className="text-xs text-base-content/60 space-y-0.5">
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
            )}

            {/* Arbiscan */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Arbiscan API</h2>
              <div className="stats stats-vertical sm:stats-horizontal shadow w-full bg-base-100">
                <div className="stat">
                  <div className="stat-title">Calls today</div>
                  <div className="stat-value text-primary">{data.arbiscan?.calls ?? "—"}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Daily limit</div>
                  <div className="stat-value">{data.arbiscan?.limit ?? "—"}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Usage %</div>
                  <div className={`stat-value ${(data.arbiscan?.percentage ?? 0) >= 80 ? "text-error" : ""}`}>
                    {data.arbiscan?.percentage != null ? `${data.arbiscan.percentage}%` : "—"}
                  </div>
                </div>
              </div>
            </section>

            {/* Files */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Payout files (data/propfirms)</h2>
              <div className="card card-border bg-base-100 shadow">
                <div className="card-body">
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <span className="text-base-content/60">Total size: </span>
                      <strong>{data.files?.totalMB != null ? `${data.files.totalMB} MB` : "—"}</strong>
                    </div>
                    <div>
                      <span className="text-base-content/60">Files: </span>
                      <strong>{data.files?.totalFiles ?? "—"}</strong>
                    </div>
                  </div>
                  {data.files?.error && (
                    <p className="text-error text-sm mt-2">{data.files.error}</p>
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
                              <td>{f.over5MB ? <span className="badge badge-warning">&gt;5MB</span> : null}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Database */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Database (row counts)</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {data.database &&
                  Object.entries(data.database).map(([table, count]) => (
                    <div key={table} className="card card-border bg-base-100 shadow">
                      <div className="card-body py-4">
                        <div className="stat padding-0">
                          <div className="stat-title text-xs">{table}</div>
                          <div className="stat-value text-lg">{count != null ? count.toLocaleString() : "—"}</div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </section>

            {/* Cache */}
            <section>
              <h2 className="text-lg font-semibold mb-4">Cache (since process start)</h2>
              <div className="stats stats-vertical sm:stats-horizontal shadow w-full bg-base-100">
                <div className="stat">
                  <div className="stat-title">Hits</div>
                  <div className="stat-value text-secondary">{data.cache?.hits ?? "—"}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Misses</div>
                  <div className="stat-value">{data.cache?.misses ?? "—"}</div>
                </div>
                <div className="stat">
                  <div className="stat-title">Hit rate</div>
                  <div className="stat-value">
                    {data.cache?.hitRate != null ? `${(data.cache.hitRate * 100).toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>
            </section>

            {/* API latency / errors note */}
            <section>
              <h2 className="text-lg font-semibold mb-4">API latency & error rates</h2>
              <div className="card card-border bg-base-100 shadow">
                <div className="card-body">
                  <p className="text-base-content/80">
                    {data.apiLatency?.note ?? "See Vercel Analytics for P50/P95/P99 by route."}
                  </p>
                  <p className="text-base-content/80 mt-2">
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
