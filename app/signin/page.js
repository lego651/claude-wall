"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { createClient } from "@/libs/supabase/client";
import config from "@/config";

// Sign-in page with Google OAuth only
// Successful login redirects to /api/auth/callback where the Code Exchange is processed
export default function Login() {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);
  const [pendingWallet, setPendingWallet] = useState(null);

  useEffect(() => {
    // Check if there's a pending wallet address from the connect-wallet flow
    if (typeof window !== "undefined") {
      const storedWallet = sessionStorage.getItem("pending_wallet_address");
      if (storedWallet) {
        setPendingWallet(storedWallet);
      }
    }
  }, []);

  const handleGoogleSignIn = async (e) => {
    e?.preventDefault();

    setIsLoading(true);

    try {
      // Ensure we're using the current origin (localhost in dev, production in prod)
      const currentOrigin = window.location.origin;
      
      // Include pending wallet address in redirect URL if it exists
      let redirectURL = `${currentOrigin}/api/auth/callback`;
      
      // Store wallet in sessionStorage as backup (OAuth providers may strip query params)
      if (pendingWallet) {
        // Store in sessionStorage as backup
        sessionStorage.setItem("pending_wallet_address", pendingWallet);
        redirectURL += `?wallet=${encodeURIComponent(pendingWallet)}`;
      }

      // Log for debugging (always log in development, check origin for localhost)
      const isLocalhost = currentOrigin.includes("localhost") || currentOrigin.includes("127.0.0.1");
      if (isLocalhost) {
        console.log("🔐 OAuth redirect URL:", redirectURL);
        console.log("📍 Current origin:", currentOrigin);
        console.log("💼 Pending wallet:", pendingWallet || "none");
        console.log("💡 If you're redirected to production, check Supabase Dashboard → Authentication → URL Configuration");
        console.log("📖 See OAUTH_SETUP.md for setup instructions");
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectURL,
          // Pass wallet in queryParams which Supabase preserves
          queryParams: pendingWallet ? {
            wallet: pendingWallet,
          } : {},
        },
      });

      if (error) {
        console.error("❌ OAuth error:", error);
        const errorMessage = isLocalhost
          ? `OAuth error: ${error.message}\n\nMake sure ${currentOrigin}/api/auth/callback is whitelisted in your Supabase project settings.\n\nSee OAUTH_SETUP.md for details.`
          : `OAuth error: ${error.message}`;
        alert(errorMessage);
      } else if (isLocalhost) {
        console.log("✅ OAuth initiated:", data);
      }
    } catch (error) {
      console.error("Error signing in with Google:", error);
      alert(`Sign-in error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-8" data-theme={config.colors.theme}>
      <div className="w-full max-w-md">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8 text-white"
              viewBox="0 0 48 48"
            >
              <path
                fill="#FFC107"
                d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
              />
              <path
                fill="#FF3D00"
                d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
              />
              <path
                fill="#4CAF50"
                d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
              />
              <path
                fill="#1976D2"
                d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-center mb-2">
          Sign in to your account
        </h1>

        {/* Description */}
        <p className="text-center text-gray-600 mb-8">
          Verify your email to sync your trading history.
        </p>

        {/* Show pending wallet address if exists */}
        {pendingWallet && (
          <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-xl">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-purple-600 mt-0.5 shrink-0"
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
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-900 mb-1">
                  Wallet address ready to link
                </p>
                <p className="text-xs text-purple-700 font-mono break-all">
                  {pendingWallet}
                </p>
                <p className="text-xs text-purple-600 mt-2">
                  This wallet will be linked to your account after sign-in.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          className="btn btn-block btn-outline border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 h-auto"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                viewBox="0 0 48 48"
              >
                <path
                  fill="#FFC107"
                  d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                />
                <path
                  fill="#FF3D00"
                  d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
                />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        {/* Change onboarding path link */}
        <div className="mt-6 text-center">
          <Link
            href={pendingWallet ? "/connect-wallet" : "/connect-wallet"}
            className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path
                fillRule="evenodd"
                d="M15 10a.75.75 0 01-.75.75H7.612l2.158 1.96a.75.75 0 11-1.04 1.08l-3.5-3.25a.75.75 0 010-1.08l3.5-3.25a.75.75 0 111.04 1.08L7.612 9.25h6.638A.75.75 0 0115 10z"
                clipRule="evenodd"
              />
            </svg>
            Change onboarding path
          </Link>
        </div>
      </div>
    </main>
  );
}
