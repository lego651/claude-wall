"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/AdminLayout";

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
              <h2 className="text-lg font-semibold mb-4">Payout files (data/payouts)</h2>
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
