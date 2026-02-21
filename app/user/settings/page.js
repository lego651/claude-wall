"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import apiClient from "@/lib/api";
import config from "@/config";
import SubscriptionsSection from "@/components/user/settings/SubscriptionsSection";

const SECTIONS = [
  { id: "account", label: "Account" },
  { id: "subscriptions", label: "Subscriptions" },
];

export default function SettingsPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState("account");

  // Open tab from URL e.g. /user/settings?tab=subscriptions
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && SECTIONS.some((s) => s.id === tab)) {
      setActiveSection(tab);
    }
  }, [searchParams]);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  
  // Profile links
  const [twitter, setTwitter] = useState("");
  const [instagram, setInstagram] = useState("");
  const [youtube, setYoutube] = useState("");
  
  // Wallet
  const [walletAddress, setWalletAddress] = useState("");
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [isValidatingWallet, setIsValidatingWallet] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [isDeletingWallet, setIsDeletingWallet] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const {
          data: { user: currentUser },
        } = await supabase.auth.getUser();

        if (!currentUser) {
          router.push(config.auth.loginUrl);
          return;
        }

        setUser(currentUser);

        // Load user profile data, create if it doesn't exist
        let { data: profile, error } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", currentUser.id)
          .single();

        // If profile doesn't exist, create it
        if (error && error.code === "PGRST116") {
          // Profile doesn't exist, create it
          const { data: newProfile, error: createError } = await supabase
            .from("user_profiles")
            .insert({
              id: currentUser.id,
              email: currentUser.email,
            })
            .select()
            .single();

          if (createError) {
            console.error("Error creating profile:", createError);
          } else {
            profile = newProfile;
          }
        } else if (error) {
          console.error("Error loading profile:", error);
        }

        if (profile) {
          setTwitter(profile.twitter || "");
          setInstagram(profile.instagram || "");
          setYoutube(profile.youtube || "");
          setWalletAddress(profile.wallet_address || "");
          setNewWalletAddress(""); // Reset new wallet input
        }
      } catch (error) {
        console.error("Error loading user data:", error);
        toast.error("Failed to load user data");
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [router, supabase]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setIsSaving(true);

    try {
      const { error } = await apiClient.post("/user/profile", {
        twitter,
        instagram,
        youtube,
        // Don't update wallet_address here - use separate handlers
      });

      if (error) {
        throw error;
      }

      toast.success("Profile saved successfully!");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLinkNewWallet = async () => {
    if (!user || !newWalletAddress.trim()) return;

    setIsValidatingWallet(true);
    setWalletError("");

    try {
      // Validate wallet first
      const validateResponse = await fetch("/api/wallet/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          wallet_address: newWalletAddress.trim(),
          current_user_id: user.id 
        }),
      });

      const validateData = await validateResponse.json();

      if (!validateResponse.ok || !validateData.valid) {
        if (validateData.reason === "prop_firm") {
          setWalletError("This wallet address belongs to a prop firm and cannot be linked.");
        } else if (validateData.reason === "already_used") {
          setWalletError("This wallet address is already linked to another account.");
        } else {
          setWalletError(validateData.error || "This wallet address cannot be used.");
        }
        setIsValidatingWallet(false);
        return;
      }

      // Link the wallet
      const linkResponse = await fetch("/api/user/link-wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ wallet_address: newWalletAddress.trim() }),
      });

      const linkData = await linkResponse.json();

      if (!linkResponse.ok) {
        throw new Error(linkData.error || "Failed to link wallet");
      }

      // Update local state
      setWalletAddress(newWalletAddress.trim());
      setNewWalletAddress("");
      toast.success("Wallet linked successfully!");
    } catch (error) {
      console.error("Error linking wallet:", error);
      setWalletError(error.message || "Failed to link wallet. Please try again.");
    } finally {
      setIsValidatingWallet(false);
    }
  };

  const handleDeleteWallet = async () => {
    if (!user || !walletAddress) return;

    if (!confirm("Are you sure you want to remove your wallet address? This will disconnect your wallet from your account.")) {
      return;
    }

    setIsDeletingWallet(true);
    setWalletError("");

    try {
      const { error } = await apiClient.post("/user/profile", {
        twitter,
        instagram,
        youtube,
        wallet_address: null, // Set to null to delete
      });

      if (error) {
        throw error;
      }

      setWalletAddress("");
      toast.success("Wallet address removed successfully!");
    } catch (error) {
      console.error("Error deleting wallet:", error);
      toast.error("Failed to remove wallet address");
    } finally {
      setIsDeletingWallet(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      await supabase.auth.signOut();
      router.push("/");
      toast.success("Signed out successfully");
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Failed to sign out");
    } finally {
      setIsSigningOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-200/60 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-200/60 p-8 pb-24">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
            aria-label="Back"
          >
            <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">User Settings</h1>
            <p className="text-sm text-slate-500">
              Manage your profile, preferences, and news subscriptions.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Navigation sidebar */}
          <nav className="md:col-span-1 space-y-2" aria-label="Settings sections">
            {SECTIONS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeSection === id
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="md:col-span-3 space-y-6">
            {activeSection === "account" && (
              <>

        {/* Profile Links Section */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5 text-gray-600"
            >
              <path
                fillRule="evenodd"
                d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
                clipRule="evenodd"
              />
            </svg>
            <h2 className="text-xl font-bold">Profile Links</h2>
          </div>

          <div className="space-y-4">
            {/* Twitter */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                X (Twitter)
              </label>
              <input
                type="text"
                placeholder="@username"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                className="input input-bordered w-full"
              />
            </div>

            {/* Instagram */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
                Instagram
              </label>
              <input
                type="text"
                placeholder="instagram.com/yourprofile"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="input input-bordered w-full"
              />
            </div>

            {/* YouTube */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
                YouTube Channel
              </label>
              <input
                type="text"
                placeholder="youtube.com/c/yourname"
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                className="input input-bordered w-full"
              />
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              onClick={() => {
                // Reset to original values
                window.location.reload();
              }}
              className="btn btn-outline"
            >
              Discard Changes
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="btn btn-primary"
            >
              {isSaving ? (
                <span className="loading loading-spinner loading-sm"></span>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M5.433 13.917l1.82-1.821A7.002 7.002 0 0117 8a7.001 7.001 0 01-9.604 6.243l-1.82 1.821a8.999 8.999 0 101.647-1.147z" />
                    <path d="M12.316 3.651a.5.5 0 00-.632 0l-3 2.5a.5.5 0 10.632.759l2.684-2.237 2.684 2.237a.5.5 0 00.632-.759l-3-2.5z" />
                  </svg>
                  Save Profile
                </>
              )}
            </button>
          </div>
        </div>

        {/* Wallet Connection Section */}
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5 text-gray-600"
            >
              <path d="M2 10.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
              <path d="M2 10.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16a5.973 5.973 0 01-3-.803V14a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z"
                clipRule="evenodd"
              />
            </svg>
            <h2 className="text-xl font-bold">Wallet Connection</h2>
          </div>

          <p className="text-gray-600 mb-6">
            Connect your wallet address to sync your trading history and verify payouts. Each account can only have one wallet address.
          </p>

          {/* Current Wallet */}
          {walletAddress && (
            <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700 mb-1">Current Wallet</p>
                  <p className="text-sm font-mono text-gray-900 break-all">{walletAddress}</p>
                </div>
                <button
                  onClick={handleDeleteWallet}
                  disabled={isDeletingWallet}
                  className="btn btn-sm btn-outline btn-error ml-4 shrink-0"
                >
                  {isDeletingWallet ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : (
                    "Remove"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Link New Wallet */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                {walletAddress ? "Link New Wallet Address" : "Wallet Address"}
              </label>
              <input
                type="text"
                placeholder="0x... or solana address"
                value={newWalletAddress}
                onChange={(e) => {
                  setNewWalletAddress(e.target.value);
                  setWalletError("");
                }}
                className="input input-bordered w-full font-mono"
                disabled={isValidatingWallet}
              />
              {walletError && (
                <p className="mt-2 text-sm text-red-600">{walletError}</p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                We support Ethereum, Arbitrum, Polygon, and Solana wallets. Prop firm addresses cannot be linked.
              </p>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              onClick={handleLinkNewWallet}
              disabled={isValidatingWallet || !newWalletAddress.trim()}
              className="btn btn-primary"
            >
              {isValidatingWallet ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Validating...
                </>
              ) : (
                walletAddress ? "Link New Wallet" : "Link Wallet"
              )}
            </button>
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-white border border-red-200 rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5 text-red-600"
            >
              <path
                fillRule="evenodd"
                d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
                clipRule="evenodd"
              />
              <path
                fillRule="evenodd"
                d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-1.134a.75.75 0 10-1.004-1.132l-2.5 2.25a.75.75 0 000 1.132l2.5 2.25a.75.75 0 101.004-1.134l-1.048-1.134h9.546A.75.75 0 0019 10z"
                clipRule="evenodd"
              />
            </svg>
            <h2 className="text-xl font-bold">Security</h2>
          </div>

          <p className="text-gray-600 mb-4">
            Logging out will remove your active session from this device.
          </p>

          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="btn btn-outline btn-error"
          >
            {isSigningOut ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              "Sign out from all devices"
            )}
          </button>
        </div>
            </>
            )}
            {activeSection === "subscriptions" && <SubscriptionsSection />}
          </div>
        </div>
      </div>
    </main>
  );
}
