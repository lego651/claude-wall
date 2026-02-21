"use client";

import Link from "next/link";
import PropProofLayout from "@/components/common/PropProofLayout";
import SubscriptionsSection from "@/components/user/settings/SubscriptionsSection";

export default function SubscriptionsPage() {
  return (
    <PropProofLayout>
      {/* Header - same style as My Dashboard */}
      <div className="bg-white border-b border-slate-200 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">Manage subscriptions</h1>
              <p className="text-sm text-slate-500">
                Choose which prop firms to follow for weekly digests.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/user/dashboard"
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-8">
        <SubscriptionsSection />
      </div>
    </PropProofLayout>
  );
}
