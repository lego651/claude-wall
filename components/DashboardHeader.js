"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Dashboard Header Component
 * Displays navigation, user info, and action buttons
 */
export default function DashboardHeader({ onSettingsClick, onRequestPayoutClick }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

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
    };

    loadUser();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  const navItems = [
    { label: "Dashboard", path: "/dashboard" },
    { label: "Payout History", path: "/dashboard/payout-history" },
    { label: "Tax Reports", path: "/dashboard/tax-reports" },
  ];

  const displayName = profile?.display_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
  const accountType = profile?.has_access ? "Premium Account" : "Standard Account";

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg" style={{ backgroundColor: '#635BFF' }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">PropPulse</span>
          </Link>

          {/* Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    isActive
                      ? "text-white"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                  style={isActive ? { backgroundColor: '#635BFF' } : {}}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3">
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
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
