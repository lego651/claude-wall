import AdminLayout from "@/components/AdminLayout";
import Link from "next/link";

export default function AdminPropFirmsPage() {
  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">Prop Firms Management</h1>
          </div>
          <p className="text-lg text-gray-400 font-medium max-w-2xl leading-relaxed">
            Manage prop firm data, wallet addresses, and verified payout tracking information.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white border border-gray-100 p-8 rounded-[24px] shadow-sm">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Firms</div>
            <div className="text-4xl font-black text-gray-900">12</div>
          </div>
          <div className="bg-white border border-gray-100 p-8 rounded-[24px] shadow-sm">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Tracked Addresses</div>
            <div className="text-4xl font-black text-indigo-600">48</div>
          </div>
          <div className="bg-white border border-gray-100 p-8 rounded-[24px] shadow-sm">
            <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Total Payouts</div>
            <div className="text-4xl font-black text-emerald-500">$2.4M</div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm p-10">
          <h2 className="text-2xl font-black text-gray-900 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/admin/propfirms/manage"
              className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
            >
              <div>
                <h3 className="text-lg font-black text-gray-900 mb-1">Manage Firms</h3>
                <p className="text-sm text-gray-500">Add, edit, or remove prop firms</p>
              </div>
              <svg className="w-6 h-6 text-gray-400 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <Link
              href="/admin/propfirms/addresses"
              className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
            >
              <div>
                <h3 className="text-lg font-black text-gray-900 mb-1">Wallet Addresses</h3>
                <p className="text-sm text-gray-500">Manage tracked wallet addresses</p>
              </div>
              <svg className="w-6 h-6 text-gray-400 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <Link
              href="/propfirms"
              className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-emerald-50 hover:border-emerald-200 transition-all group"
            >
              <div>
                <h3 className="text-lg font-black text-gray-900 mb-1">View Public Page</h3>
                <p className="text-sm text-gray-500">See how users view prop firms</p>
              </div>
              <svg className="w-6 h-6 text-gray-400 group-hover:text-emerald-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </Link>

            <Link
              href="/admin/propfirms/analytics"
              className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
            >
              <div>
                <h3 className="text-lg font-black text-gray-900 mb-1">Analytics</h3>
                <p className="text-sm text-gray-500">View payout trends and statistics</p>
              </div>
              <svg className="w-6 h-6 text-gray-400 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-indigo-50 border border-indigo-100 rounded-[40px] p-8">
          <div className="flex items-start gap-4">
            <div className="bg-indigo-600 p-2 rounded-xl text-white flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 mb-2">About Prop Firms Management</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                This section allows you to manage prop firm data including company information, wallet addresses for payout tracking,
                and analytics. All changes here will be reflected on the public-facing prop firms directory.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
