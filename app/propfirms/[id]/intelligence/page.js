"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { THEME } from "@/lib/theme";
import IntelligenceCard from "@/components/propfirms/intelligence/IntelligenceCard";
import IntelligenceCardSkeleton from "@/components/propfirms/intelligence/IntelligenceCardSkeleton";
import { IntelligenceCategory, ConfidenceLevel } from "./types";

// Map incident_type to display category (OPERATIONAL vs REPUTATION)
const INCIDENT_TYPE_TO_CATEGORY = {
  platform_technical_issue: IntelligenceCategory.OPERATIONAL,
  support_issue: IntelligenceCategory.OPERATIONAL,
  payout_delay: IntelligenceCategory.OPERATIONAL,
  payout_denied: IntelligenceCategory.OPERATIONAL,
  kyc_withdrawal_issue: IntelligenceCategory.OPERATIONAL,
  execution_conditions: IntelligenceCategory.OPERATIONAL,
  high_risk_allegation: IntelligenceCategory.REPUTATION,
  scam_warning: IntelligenceCategory.REPUTATION,
  rules_dispute: IntelligenceCategory.REPUTATION,
  pricing_fee_complaint: IntelligenceCategory.REPUTATION,
  payout_issue: IntelligenceCategory.REPUTATION,
  platform_issue: IntelligenceCategory.REPUTATION,
  rule_violation: IntelligenceCategory.REPUTATION,
  other: IntelligenceCategory.REPUTATION,
};

function getDisplayCategory(incidentType) {
  return INCIDENT_TYPE_TO_CATEGORY[incidentType] || IntelligenceCategory.REPUTATION;
}

function getConfidenceLevel(severity) {
  if (severity === "high") return ConfidenceLevel.HIGH;
  if (severity === "medium") return ConfidenceLevel.MEDIUM;
  return ConfidenceLevel.LOW;
}

/** Derive meaningful label and domain from source URL (no "Link 1", "Link 2"). */
function getLabelAndDomainFromUrl(url, index) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host.includes("trustpilot")) {
      const label =
        index === 0 ? "Trustpilot Review" : `Trustpilot Review #${index + 1}`;
      return { label, domain: host };
    }
    const name = host.split(".")[0] ?? host;
    const label = name
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    return { label: label || host, domain: host };
  } catch {
    return { label: "Source", domain: "" };
  }
}

/** Map API incident to IntelligenceItem for the card. */
function incidentToItem(inc) {
  const tags = inc.review_count > 0 ? ["Trustpilot"] : ["Trustpilot"];
  const sourceLinks = inc.source_links || [];
  const weekDate = inc.week_start || "";
  const sources = sourceLinks.slice(0, 3).map((url, i) => {
    const { label, domain } = getLabelAndDomainFromUrl(url, i);
    return {
      id: `s${inc.id}-${i}`,
      label,
      url,
      type: "web",
      domain,
      date: weekDate,
    };
  });

  return {
    id: String(inc.id),
    category: getDisplayCategory(inc.incident_type),
    date: weekDate,
    title: inc.title,
    summary: inc.summary,
    confidence: getConfidenceLevel(inc.severity),
    tags,
    sources,
  };
}

// Filter icon (inline SVG, no lucide dependency)
function FilterIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
      />
    </svg>
  );
}

// ChevronDown icon
function ChevronDownIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

export default function PropFirmIntelligencePage() {
  const params = useParams();
  const firmId = params?.id;

  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    if (!firmId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/v2/propfirms/${firmId}/incidents?days=90`)
      .then((r) => (r.ok ? r.json() : { incidents: [] }))
      .then((data) => {
        if (!cancelled) setIncidents(data.incidents || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [firmId]);

  const filtered =
    typeFilter === "all"
      ? incidents
      : incidents.filter(
          (i) => getDisplayCategory(i.incident_type) === typeFilter
        );
  const items = filtered.map(incidentToItem);

  return (
    <div className="py-2">
      {/* Intelligence Feed Header — matches reference */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Firm Intelligence Feed
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Curated, summarized, and classified signals from the last 90 days.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="appearance-none bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg pl-4 pr-10 py-2 hover:bg-slate-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-indigo-500/20 min-w-[140px]"
            >
              <option value="all">All Types</option>
              <option value={IntelligenceCategory.REPUTATION}>Reputation</option>
              <option value={IntelligenceCategory.OPERATIONAL}>
                Operational
              </option>
              <option value={IntelligenceCategory.REGULATORY}>Regulatory</option>
            </select>
            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
          <button
            type="button"
            className="p-2.5 bg-white border border-slate-200 text-slate-400 rounded-lg hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-sm"
            aria-label="Filter"
          >
            <FilterIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Feed Timeline — skeleton when loading, IntelligenceCard per item when loaded */}
      {loading ? (
        <div className="relative">
          <div
            className="absolute left-[5px] top-4 bottom-4 w-0.5 bg-slate-200"
            aria-hidden
          />
          <IntelligenceCardSkeleton />
          <IntelligenceCardSkeleton />
          <IntelligenceCardSkeleton />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <p className="text-slate-500">
            {incidents.length === 0
              ? "No intelligence signals in the last 90 days."
              : "No incidents match the selected type."}
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical timeline line — aligned with 8px dot center (dot column 12px) */}
          <div
            className="absolute left-[5px] top-4 bottom-4 w-0.5 bg-slate-200"
            aria-hidden
          />
          {items.map((item, index) => (
            <IntelligenceCard
              key={item.id}
              item={item}
              isLast={index === items.length - 1}
            />
          ))}
        </div>
      )}

      {/* Footer CTA — matches reference */}
      <footer className="mt-12">
        <div
          className="rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 text-white overflow-hidden relative"
          style={{ backgroundColor: "#0f172a" }}
        >
          <div className="relative z-10 text-center md:text-left">
            <h3 className="text-xl font-bold mb-2">Want real-time alerts?</h3>
            <p className="text-slate-400 text-sm">
              Get instant notifications when new signals are detected for your
              tracked firms.
            </p>
          </div>
          <button
            type="button"
            className="relative z-10 px-8 py-3 text-white font-bold rounded-xl hover:opacity-90 transition-opacity shadow-lg"
            style={{
              backgroundColor: THEME.primary,
              boxShadow: "0 10px 15px -3px rgba(99, 91, 255, 0.2)",
            }}
          >
            Enable Notifications
          </button>
          <div
            className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -mr-20 -mt-20 opacity-30"
            style={{ backgroundColor: THEME.primary }}
          />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl -ml-20 -mb-20" />
        </div>
        <p className="mt-8 text-center text-slate-400 text-xs">
          Intelligence Layer • Updated hourly
        </p>
      </footer>
    </div>
  );
}
