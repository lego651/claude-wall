"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

export default function PropFirmIntelligencePage() {
  const params = useParams();
  const firmId = params?.id;

  return (
    <div className="py-12">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center max-w-xl mx-auto">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 mb-4">
          <svg
            className="w-7 h-7 text-slate-400"
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
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Intelligence Layer
        </h2>
        <p className="text-slate-600 text-sm mb-6">
          Full intelligence reports and incident history for this firm will be
          available here soon.
        </p>
        <Link
          href={`/propfirm/${firmId}`}
          className="inline-flex items-center gap-2 text-sm font-semibold hover:underline"
          style={{ color: "#635BFF" }}
        >
          Back to Overview
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
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
