"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PropProofLayout = ({ children }) => {
  const pathname = usePathname();

  const navItems = [
    { label: "Payouts", path: "/propfirms" },
    { label: "Analytics", path: "/analytics" },
    { label: "Compare", path: "/firms" },
  ];

  return (
    <div className="min-h-screen bg-slate-200/60 text-gray-900 flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/propfirms" className="flex items-center gap-2 group">
              <div className="bg-indigo-600 p-1.5 rounded-lg group-hover:bg-indigo-700 transition-colors">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900">PropPulse</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    pathname === item.path
                      ? "text-indigo-600 bg-indigo-50"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <a 
              href="https://x.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              X Community
            </a>
            <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
              Connect Wallet
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-4">
              <p className="text-xs text-slate-500 leading-relaxed uppercase font-bold tracking-tight">Technical Disclaimer</p>
              <p className="text-sm text-slate-500 leading-relaxed">
                Note: We can only track payouts through Riseworks.io. Firms may also payout via additional methods and use their Rise wallets for other operating expenses, not solely for trader payouts.
              </p>
            </div>
            <div className="space-y-4 md:text-right">
              <p className="text-xs text-slate-500 leading-relaxed uppercase font-bold tracking-tight">Data Integrity</p>
              <p className="text-sm text-slate-500 leading-relaxed">
                All displayed information is publicly accessible blockchain data, using data that can be independently verified through any blockchain explorer. Listings on this platform are not endorsements.
              </p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-slate-100 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center">
                <span className="text-white text-[10px] font-black">PP</span>
              </div>
              <span className="text-xs font-semibold text-slate-400">&copy; 2025 PropPulse. All rights reserved.</span>
            </div>
            <div className="flex gap-6">
              <a href="#" className="text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors">Privacy Policy</a>
              <a href="#" className="text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors">Terms of Service</a>
              <a href="#" className="text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PropProofLayout;
