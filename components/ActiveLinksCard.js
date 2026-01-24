"use client";

/**
 * Reusable Active Links Card Component
 * Displays list of prop firms that have sent payments to the user
 */
export default function ActiveLinksCard({ verifiedFirms = [], loading = false }) {
  const fallbackColors = ['bg-slate-900', 'bg-cyan-500', 'bg-orange-500', 'bg-purple-500', 'bg-pink-500'];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
          ACTIVE LINKS
        </h3>
        <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-4">
            <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-gray-300 border-r-transparent"></div>
            <p className="mt-2 text-xs text-gray-400">Loading firms...</p>
          </div>
        ) : verifiedFirms.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-gray-400">No active links yet</p>
          </div>
        ) : (
          verifiedFirms.map((firm, index) => {
            const colorIndex = index % fallbackColors.length;
            const logoPath = firm.logoPath || `/logos/firms/${firm.id}.png`;
            
            return (
              <a
                key={firm.id}
                href={`/propfirm/${firm.id}`}
                className="flex items-center justify-between p-3 bg-slate-50/50 hover:bg-slate-100/50 rounded-xl border border-slate-200 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg overflow-hidden shadow-sm bg-white relative">
                    <img
                      src={logoPath}
                      alt={firm.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const currentSrc = e.target.src;
                        if (currentSrc.endsWith('.webp')) {
                          e.target.src = `/logos/firms/${firm.id}.png`;
                        } else if (currentSrc.endsWith('.png')) {
                          e.target.src = `/logos/firms/${firm.id}.jpeg`;
                        } else if (currentSrc.endsWith('.jpeg')) {
                          e.target.src = `/logos/firms/${firm.id}.jpg`;
                        } else {
                          e.target.style.display = 'none';
                          const fallback = e.target.nextElementSibling;
                          if (fallback) fallback.style.display = 'flex';
                        }
                      }}
                    />
                    <div className={`hidden w-10 h-10 ${fallbackColors[colorIndex]} rounded-lg items-center justify-center text-white font-bold text-sm shadow-sm`}>
                      {firm.name.substring(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-900">{firm.name}</span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      ACTIVE
                    </span>
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}
