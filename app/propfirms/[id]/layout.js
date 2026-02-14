"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import PropProofLayout from "@/components/common/PropProofLayout";
import { THEME } from "@/lib/theme";

// Format firm id to display name (e.g. fundednext -> Funded Next)
function firmIdToName(id) {
  if (!id) return "";
  return id
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const TABS = [
  { label: "Overview", path: "", icon: "overview" },
  { label: "Payout Evidence", path: "/payouts", icon: "payout" },
  { label: "Intelligence Layer", path: "/intelligence", icon: "intelligence" },
];

export default function PropFirmIdLayout({ children }) {
  const params = useParams();
  const pathname = usePathname();
  const firmId = params?.id;
  const [firm, setFirm] = useState(null);

  const basePath = `/propfirms/${firmId}`;
  const displayName = firm?.name || firmIdToName(firmId);
  const website =
    firm?.website || `https://${(firmId || "").replace(/-/g, "")}.com`;

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

  // Try jpeg first (fundednext.jpeg exists); then webp, png, jpg
  const getLogoUrl = (ext = "jpeg") =>
    `/logos/firms/${firmId}.${ext}`;

  return (
    <PropProofLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back link */}
        <Link
          href="/propfirms"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 mb-6 transition-colors hover:text-slate-700"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Signal Board
        </Link>

        {/* Firm header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden shadow-md bg-white flex-shrink-0 flex items-center justify-center">
              <img
                src={getLogoUrl("jpeg")}
                alt={displayName}
                className="w-full h-full object-contain absolute inset-0 bg-white"
                onError={(e) => {
                  const t = e.target;
                  if (t.src.endsWith(".jpeg")) t.src = getLogoUrl("webp");
                  else if (t.src.endsWith(".webp")) t.src = getLogoUrl("png");
                  else if (t.src.endsWith(".png")) t.src = getLogoUrl("jpg");
                  else {
                    t.style.display = "none";
                    const fallback = t.nextElementSibling;
                    if (fallback) fallback.classList.remove("hidden");
                  }
                }}
              />
              <div className="hidden absolute inset-0 w-full h-full bg-slate-900 items-center justify-center">
                <span className="text-white text-xl font-black">
                  {displayName.substring(0, 2).toUpperCase()}
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-slate-900">
                  {displayName}
                </h1>
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                  VERIFIED PAYOUTS
                </span>
              </div>
              <a
                href={website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm font-medium hover:underline"
                style={{ color: THEME.primary }}
              >
                {website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
            >
              Track Signals
            </button>
            <button
              type="button"
              className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-2"
            >
              <svg
                className="w-4 h-4 text-yellow-400 fill-yellow-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Start Evaluation
            </button>
          </div>
        </div>

        {/* Tabs: Overview | Payout Evidence | Intelligence Layer — on top, active = purple + underline */}
        <nav
          className="flex items-center gap-0 border-b border-slate-200 mb-8"
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
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all border-b-2 -mb-px ${
                  isActive
                    ? ""
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
                style={isActive ? { borderColor: THEME.primary, color: THEME.primary } : {}}
              >
                {tab.icon === "overview" && (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4"
                    />
                  </svg>
                )}
                {tab.icon === "payout" && (
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <rect x="4" y="14" width="4" height="6" rx="1" />
                    <rect x="10" y="9" width="4" height="11" rx="1" />
                    <rect x="16" y="5" width="4" height="15" rx="1" />
                  </svg>
                )}
                {tab.icon === "intelligence" && (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
                {tab.label}
                {tab.icon === "intelligence" && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                    style={{ backgroundColor: THEME.primary }}
                  >
                    NEW
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </PropProofLayout>
  );
}
