/**
 * EmailIngestTab — Gmail ingest pipeline status for the admin dashboard.
 * Renders last run, stats row, status badge, and recent runs table.
 * Data is fetched lazily by the parent (dashboard) and passed as props.
 */

const STATUS_CONFIG = {
  ok: { label: "OK", badgeClass: "badge-success" },
  warning: { label: "Warning", badgeClass: "badge-warning" },
  critical: { label: "Critical", badgeClass: "badge-error" },
};

function formatRelative(iso) {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffM = diffMs / 60000;
  const diffH = diffMs / 3600000;
  const diffD = diffMs / 86400000;
  if (diffM < 60) return `${Math.round(diffM)}m ago`;
  if (diffH < 24) return `${Math.round(diffH)}h ago`;
  if (diffD < 7) return `${Math.round(diffD)}d ago`;
  return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export default function EmailIngestTab({ data, loading, error }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="loading loading-spinner loading-lg" style={{ color: "#635BFF" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="alert alert-error">
        <span>{error}</span>
      </div>
    );
  }

  if (!data) return null;

  const statusConf = STATUS_CONFIG[data.status] ?? STATUS_CONFIG.critical;
  const stats = data.stats ?? {};

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-4">Email Ingest – Gmail pipeline stats</h2>

        {/* Status + last run */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className={`badge ${statusConf.badgeClass} badge-lg`}>{statusConf.label}</span>
          <span className="text-sm text-slate-600">
            Last run: <span className="font-medium">{formatRelative(data.lastRun)}</span>
          </span>
          {data.statusReason && (
            <span className="text-sm text-slate-400">{data.statusReason}</span>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Processed", value: stats.processed ?? 0 },
            { label: "Inserted", value: stats.inserted ?? 0 },
            { label: "Skipped", value: stats.skipped ?? 0 },
            { label: "Errors", value: stats.errors ?? 0, highlight: (stats.errors ?? 0) > 0 },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
              <div className={`text-2xl font-bold mt-1 ${highlight ? "text-red-600" : "text-slate-700"}`}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Recent runs table */}
        <h3 className="text-base font-semibold mb-3">Recent runs</h3>
        {!data.recentRuns?.length ? (
          <p className="text-slate-500">No runs recorded yet.</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden max-w-lg">
            <table className="table table-sm w-full">
              <thead>
                <tr>
                  <th className="font-medium">Time</th>
                  <th className="text-right font-medium">Inserted</th>
                  <th className="text-right font-medium">Errors</th>
                </tr>
              </thead>
              <tbody>
                {data.recentRuns.map((run, i) => (
                  <tr key={i}>
                    <td className="text-slate-600 tabular-nums">{formatRelative(run.ranAt)}</td>
                    <td className="text-right tabular-nums">{run.inserted ?? 0}</td>
                    <td
                      className={`text-right tabular-nums ${(run.errors ?? 0) > 0 ? "text-red-600 font-medium" : ""}`}
                    >
                      {run.errors ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
