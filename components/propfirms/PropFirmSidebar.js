"use client";

import Link from "next/link";
import { THEME } from "@/lib/theme";
import { getFirmLogoUrl, DEFAULT_LOGO_URL } from "@/lib/logoUtils";

/* istanbul ignore next */
function handleLogoError(e) {
  e.target.onerror = null;
  e.target.style.display = "none";
  e.target.nextElementSibling?.classList.remove("hidden");
}

export default function PropFirmSidebar({ firmId, firm }) {
  const displayName = firm?.name || (firmId || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const website = firm?.website || `https://${(firmId || "").replace(/-/g, "")}.com`;
  const logoUrl = firm ? getFirmLogoUrl(firm) : DEFAULT_LOGO_URL;
  const initials = displayName.replace(/\s+/g, "").substring(0, 2).toUpperCase();

  return (
    <div className="flex flex-col gap-6 w-full lg:w-80 shrink-0">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center">
        <div className="mt-10 w-24 h-24 bg-white border border-slate-100 shadow-sm rounded-2xl flex items-center justify-center mb-4 overflow-hidden p-2">
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            {logoUrl && (
              <img
                src={logoUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-contain z-10"
                onError={handleLogoError}
              />
            )}
            <div className={`flex flex-col items-center ${logoUrl ? "hidden" : ""}`} aria-hidden={!!logoUrl}>
              <div className="text-2xl font-black text-slate-800">{initials}</div>
              <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{displayName}</div>
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-1">{displayName}</h1>
        <a href={website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium mb-10 group cursor-pointer hover:underline" style={{ color: THEME.primary }}>
          {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          <svg className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
        </a>

        <div className="w-full mt-2 pt-6 border-t border-slate-100">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-bold text-slate-800">Intelligence Status</h2>
            <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded font-bold uppercase tracking-wider">Stable</span>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3 items-start">
              <div className="shrink-0 mt-0.5" style={{ color: THEME.primary }}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="5" y="15" width="14" height="4" rx="0.5" /><rect x="7" y="10" width="10" height="4" rx="0.5" /><rect x="9" y="5" width="6" height="4" rx="0.5" /></svg>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Payout
                </div>
                <p className="text-[11px] text-slate-600 leading-tight font-medium">Consistent daily payout volume with high velocity.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="shrink-0 mt-0.5 text-emerald-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                  Trustpilot
                </div>
                <p className="text-[11px] text-slate-600 leading-tight font-medium">Reliable customer support signals and frequent positive mentions.</p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <div className="shrink-0 mt-0.5 text-sky-400">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                  Social
                </div>
                <p className="text-[11px] text-slate-600 leading-tight font-medium">High discussion around new scaling rules on social media.</p>
              </div>
            </div>
          </div>

          <Link href={`/propfirms/${firmId}/intelligence`} className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-[11px] font-bold text-slate-500 transition-colors text-center">
            View full analytics
            <svg className="w-4 h-4 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </div>

      <div className="rounded-2xl p-6 text-white relative overflow-hidden shadow-lg" style={{ backgroundColor: THEME.primary, boxShadow: `0 10px 15px -3px ${THEME.primary}20, 0 4px 6px -2px ${THEME.primary}15` }}>
        <div className="relative z-10">
          <h3 className="text-lg font-bold mb-2">Signal Alert</h3>
          <p className="text-indigo-100 text-xs mb-6 leading-relaxed">
            Monitor payout clusters and social patterns. Get notified when stability thresholds are breached.
          </p>
          <button type="button" className="w-full bg-white font-bold text-xs py-2.5 rounded-xl hover:bg-indigo-50 transition-colors" style={{ color: THEME.primary }}>
            Setup Alerts
          </button>
        </div>
        <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-10 w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full fill-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
        </div>
      </div>
    </div>
  );
}
