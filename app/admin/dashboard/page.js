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

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-bold text-base-content">System health</h1>
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

        {data && (
          <div className="space-y-8">
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
