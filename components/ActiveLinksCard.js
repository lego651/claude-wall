"use client";

import config from "@/config";

/**
 * Verified Firm Payouts Card
 * Lists prop firms that have sent payments to the user, with aggregated payout amounts
 * and a bar for visual comparison. Includes disclaimer and CTA for untracked firms.
 */
export default function ActiveLinksCard({ verifiedFirms = [], loading = false }) {
  const fallbackColors = ["bg-slate-900", "bg-cyan-500", "bg-orange-500", "bg-purple-500", "bg-pink-500"];
  const maxPayout = verifiedFirms.length > 0
    ? Math.max(...verifiedFirms.map((f) => f.totalPayout || 0), 1)
    : 1;

  const submitFirmMailto = config?.resend?.supportEmail
    ? `mailto:${config.resend.supportEmail}?subject=Untracked%20prop%20firm%20wallet&body=Hi%2C%20I%20received%20payouts%20from%20a%20prop%20firm%20that%20is%20not%20in%20your%20list.%20Please%20add%20this%20wallet%20address%20for%20tracking%3A%0A%0A%5Bpaste%20wallet%20address%20here%5D`
    : "#";

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
          Verified firm payouts
        </h3>
        <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <p className="text-[10px] text-slate-400 mb-4">
        Bar = your total payout from that firm (relative size)
      </p>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-4">
            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-gray-300 border-r-transparent"></div>
            <p className="mt-2 text-xs text-gray-400">Loading firms...</p>
          </div>
        ) : verifiedFirms.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-gray-400">No verified firm payouts yet</p>
          </div>
        ) : (
          verifiedFirms.map((firm, index) => {
            const colorIndex = index % fallbackColors.length;
            const logoPath = firm.logoPath || `/logos/firms/${firm.id}.png`;
            const totalPayout = firm.totalPayout || 0;
            const barWidth = maxPayout > 0 ? Math.max(8, (totalPayout / maxPayout) * 100) : 0;

            return (
              <a
                key={firm.id}
                href={`/propfirms/${firm.id}`}
                className="flex flex-col gap-2 p-3 bg-slate-50/50 hover:bg-slate-100/50 rounded-xl border border-slate-200 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden shadow-sm bg-white relative flex-shrink-0">
                      <img
                        src={logoPath}
                        alt={firm.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const currentSrc = e.target.src;
                          if (currentSrc.endsWith(".webp")) {
                            e.target.src = `/logos/firms/${firm.id}.png`;
                          } else if (currentSrc.endsWith(".png")) {
                            e.target.src = `/logos/firms/${firm.id}.jpeg`;
                          } else if (currentSrc.endsWith(".jpeg")) {
                            e.target.src = `/logos/firms/${firm.id}.jpg`;
                          } else {
                            e.target.style.display = "none";
                            const fallback = e.target.nextElementSibling;
                            if (fallback) fallback.style.display = "flex";
                          }
                        }}
                      />
                      <div
                        className={`hidden w-10 h-10 ${fallbackColors[colorIndex]} rounded-lg items-center justify-center text-white font-bold text-sm shadow-sm`}
                      >
                        {firm.name.substring(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-sm text-slate-900 truncate">{firm.name}</span>
                      <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                        <span className="w-1 h-1 bg-emerald-500 rounded-full flex-shrink-0"></span>
                        Verified
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-bold text-sm text-slate-500 group-hover:text-slate-900 transition-colors">
                      ${totalPayout.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <svg
                      className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${barWidth}%` }} />
                </div>
              </a>
            );
          })
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-200 text-center">
        <p className="text-xs text-slate-500 mb-3">
          We only track payouts from a few known prop firms. Not all of your payouts may be shown here.
        </p>
        <div className="flex justify-center">
          <a
            href={submitFirmMailto}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors"
            style={{
              backgroundColor: "rgba(99, 91, 255, 0.1)",
              color: "#635BFF",
              border: "1px solid rgba(99, 91, 255, 0.2)",
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Submit untracked prop firm wallet
          </a>
        </div>
      </div>
    </div>
  );
}
