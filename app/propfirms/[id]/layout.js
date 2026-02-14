"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import PropProofLayout from "@/components/common/PropProofLayout";
import PropFirmSidebar from "@/components/propfirms/PropFirmSidebar";
import { THEME } from "@/lib/theme";

const TABS = [
  { label: "OVERVIEW", path: "", icon: "overview" },
  { label: "PAYOUT EVIDENCE", path: "/payouts", icon: "payout" },
  { label: "INTELLIGENCE", path: "/intelligence", icon: "intelligence" },
];

export default function PropFirmIdLayout({ children }) {
  const params = useParams();
  const pathname = usePathname();
  const firmId = params?.id;
  const [firm, setFirm] = useState(null);

  const basePath = `/propfirms/${firmId}`;
  const firmIdUpper = (firmId || "").toUpperCase().replace(/-/g, " ");

  useEffect(() => {
    if (!firmId) return;
    let cancelled = false;
    fetch(`/api/v2/propfirms/${firmId}/chart?period=30d`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.firm) setFirm(data.firm);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [firmId]);

  return (
    <PropProofLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/propfirms"
            className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            &lt; PROP INTELLIGENCE / {firmIdUpper}
          </Link>
        </div>

        {/* Layout: Sidebar (left) | Tabs + Content (right) */}
        <div className="flex flex-col lg:flex-row gap-8">
          <PropFirmSidebar firmId={firmId} firm={firm} />

          <div className="flex-1 min-w-0">
            {/* Content Tabs - in the right column only */}
            <nav
              className="flex items-center gap-8 border-b border-slate-200 mb-6"
              aria-label="Firm sections"
            >
              {TABS.map((tab) => {
                const href = `${basePath}${tab.path}`;
                const isActive =
                  pathname === href ||
                  (tab.path === "" && pathname === basePath) ||
                  (tab.path !== "" && pathname?.startsWith(href));
                return (
                  <Link
                    key={tab.path || "overview"}
                    href={href}
                    className={`pb-4 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all relative ${
                      isActive ? "" : "text-slate-400 hover:text-slate-600"
                    }`}
                    style={isActive ? { color: THEME.primary } : {}}
                  >
                    {tab.icon === "overview" && (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="4" y="14" width="4" height="6" rx="1" />
                        <rect x="10" y="9" width="4" height="11" rx="1" />
                        <rect x="16" y="5" width="4" height="15" rx="1" />
                      </svg>
                    )}
                    {tab.icon === "payout" && (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                    {tab.icon === "intelligence" && (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    )}
                    {tab.label}
                    {isActive && <div className="absolute bottom-0 left-0 w-full h-0.5 rounded-full" style={{ backgroundColor: THEME.primary }} />}
                  </Link>
                );
              })}
            </nav>

            {children}
          </div>
        </div>
      </div>
    </PropProofLayout>
  );
}
