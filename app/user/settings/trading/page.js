"use client";

import Link from "next/link";
import PropProofLayout from "@/components/common/PropProofLayout";
import TradingLogSettings from "@/components/settings/TradingLogSettings";

export default function TradingSettingsPage() {
  return (
    <PropProofLayout>
      <div className="bg-white border-b border-slate-200 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/user/settings"
              className="text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Back to settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Trading Log Settings</h1>
          </div>
          <p className="text-sm text-slate-500 ml-8">Manage accounts, daily limits, and default values.</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <TradingLogSettings />
      </div>
    </PropProofLayout>
  );
}
