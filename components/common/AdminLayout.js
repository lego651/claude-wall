"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const AdminLayout = ({ children }) => {
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", path: "/admin/dashboard" },
    { label: "Reports", path: "/admin/reports" },
    { label: "Portfolio", path: "/admin/portfolio" },
    { label: "Strategies", path: "/admin/strategies" },
    { label: "Prop Firms", path: "/admin/propfirms" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Navigation - same structure as PropProofLayout: white bar, logo + nav */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/admin" className="flex items-center gap-2 group">
              <div className="p-1.5 rounded-lg transition-colors" style={{ backgroundColor: "#635BFF" }}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900">Trading Admin</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = pathname === item.path || pathname?.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      isActive
                        ? "text-white rounded-lg"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                    style={isActive ? { backgroundColor: "#635BFF" } : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: "#635BFF" }}>
                A
              </div>
              <span className="text-sm font-semibold text-slate-900">Admin</span>
            </div>
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
              <p className="text-xs text-slate-500 leading-relaxed uppercase font-bold tracking-tight">Trading Performance Analytics</p>
              <p className="text-sm text-slate-500 leading-relaxed">
                Multi-strategy portfolio tracking system with real-time performance metrics, weekly analytics, and comprehensive reporting for professional traders.
              </p>
            </div>
            <div className="space-y-4 md:text-right">
              <p className="text-xs text-slate-500 leading-relaxed uppercase font-bold tracking-tight">Data Privacy</p>
              <p className="text-sm text-slate-500 leading-relaxed">
                All trading data is stored securely and privately. Performance metrics are calculated using proprietary algorithms and are for internal use only.
              </p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-slate-100 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center">
                <span className="text-white text-[10px] font-black">TA</span>
              </div>
              <span className="text-xs font-semibold text-slate-400">&copy; 2025 Trading Admin. All rights reserved.</span>
            </div>
            <div className="flex gap-6">
              <a href="#" className="text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors">Privacy Policy</a>
              <a href="#" className="text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors">Terms of Service</a>
              <a href="#" className="text-xs font-semibold text-slate-400 hover:text-slate-900 transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AdminLayout;
