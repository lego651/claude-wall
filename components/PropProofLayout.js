"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/libs/supabase/client";
import { THEME, themeStyles } from "@/lib/theme";
import config from "@/config";

const PropProofLayout = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      if (currentUser) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", currentUser.id)
          .single();
        setProfile(profileData);
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  const handleLogout = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Logout error:", error);
      }
      
      // Clear local state
      setUser(null);
      setProfile(null);
      
      // Force a full page reload to clear all state and cookies
      window.location.href = "/";
    } catch (error) {
      console.error("Logout error:", error);
      // Still redirect even if there's an error
      window.location.href = "/";
    }
  };

  // Always use common nav items
  const navItems = [
    { label: "Payouts", path: "/propfirms" },
    { label: "Traders", path: "/leaderboard" },
    { label: "Trading Study", path: "/study" },
  ];

  const displayName = profile?.display_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
  const accountType = profile?.has_access ? "Premium Account" : "Standard Account";

  return (
    <div className="min-h-screen bg-slate-200/60 text-gray-900 flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/propfirms" className="flex items-center gap-2 group">
              <div className="p-1.5 rounded-lg transition-colors" style={{ backgroundColor: THEME.primary }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = THEME.primaryHover} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = THEME.primary}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900">PropPulse</span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                // Check if current path matches or starts with the nav item path
                const isActive = pathname === item.path || 
                  (item.path === "/propfirms" && (pathname?.startsWith("/propfirm") || pathname?.startsWith("/propfirms"))) ||
                  (item.path === "/leaderboard" && (pathname?.startsWith("/leaderboard") || pathname?.startsWith("/trader"))) ||
                  (item.path === "/study" && pathname?.startsWith("/study"));
                
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                      isActive
                        ? ""
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                    style={isActive ? { ...themeStyles.textPrimary, ...themeStyles.bgLight } : {}}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {!loading && (
              <>
                {user ? (
                  <>
                    <Link 
                      href="/dashboard" 
                      className="hidden md:flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      {user?.user_metadata?.avatar_url ? (
                        <img
                          src={user.user_metadata.avatar_url}
                          alt={displayName}
                          className="w-8 h-8 rounded-full"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                          <span className="text-sm font-bold text-white">
                            {displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-900">{displayName}</div>
                        <div className="text-xs text-slate-500">{accountType}</div>
                      </div>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="text-sm text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </>
                ) : (
                  <Link 
                    href={config.auth.loginUrl}
                    className="text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm" 
                    style={themeStyles.button} 
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = THEME.primaryHover} 
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = THEME.primary}
                  >
                    Sign In
                  </Link>
                )}
              </>
            )}
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
