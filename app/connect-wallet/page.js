"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PropProofLayout from "@/components/PropProofLayout";
import config from "@/config";

// Connect Wallet page - First step in the two-route sign-in flow
// Users enter their wallet address, then proceed to email sign-in
// ONLY available to users who are NOT signed in
export default function ConnectWalletPage() {
  const [walletAddress, setWalletAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  // Check if user is already signed in - redirect if they are
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // User is signed in, redirect to settings page
        router.push("/settings");
      }
    };

    checkAuth();
  }, [router, supabase]);

  const validateWalletAddress = (address) => {
    // Support Ethereum, Arbitrum, Polygon (0x... format) and Solana addresses
    const ethereumPattern = /^0x[a-fA-F0-9]{40}$/;
    const solanaPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    
    return ethereumPattern.test(address) || solanaPattern.test(address);
  };

  const handleLinkWallet = async (e) => {
    e?.preventDefault();
    setError("");

    if (!walletAddress.trim()) {
      setError("Please enter a wallet address");
      return;
    }

    const trimmedAddress = walletAddress.trim();

    // Basic format validation
    if (!validateWalletAddress(trimmedAddress)) {
      setError("Invalid wallet address format. Please enter a valid Ethereum (0x...) or Solana address.");
      return;
    }

    setIsValidating(true);
    setError("");

    try {
      // Validate wallet address (check if used, check if prop firm address)
      const response = await fetch("/api/wallet/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ wallet_address: trimmedAddress }),
      });

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("API returned non-JSON response:", {
          status: response.status,
          statusText: response.statusText,
          contentType,
        });
        throw new Error("Server error. Please try again.");
      }

      const data = await response.json();

      console.log("Wallet validation response:", {
        ok: response.ok,
        status: response.status,
        data,
      });

      if (!response.ok || !data.valid) {
        // Handle specific error reasons
        if (data.reason === "prop_firm") {
          setError("This wallet address belongs to a prop firm and cannot be linked to a user account.");
        } else if (data.reason === "already_used") {
          setError("This wallet address is already being used by another account. Please enter a different wallet address.");
        } else if (data.reason === "format") {
          setError("Invalid wallet address format. Please enter a valid Ethereum (0x...) or Solana address.");
        } else {
          // Check if the error message indicates the wallet is already used
          const errorMsg = data.error || "";
          if (errorMsg.toLowerCase().includes("already") || errorMsg.toLowerCase().includes("linked")) {
            setError("This wallet address is already being used by another account. Please enter a different wallet address.");
          } else {
            setError(data.error || "This wallet address cannot be used. Please try a different address.");
          }
        }
        setIsValidating(false);
        return;
      }

      // Wallet is valid, store in sessionStorage for the sign-in flow
      sessionStorage.setItem("pending_wallet_address", trimmedAddress);
      
      // Redirect to sign-in page
      router.push(config.auth.loginUrl);
    } catch (err) {
      console.error("Error validating wallet address:", err);

      // Provide more specific error message
      if (err.message === "Failed to fetch") {
        setError("Cannot connect to server. Please ensure the development server is running (npm run dev).");
      } else if (err.message.includes("Server error")) {
        setError("Server error. Please check the console logs and try again.");
      } else {
        setError(err.message || "Unable to validate wallet address. Please check your connection and try again.");
      }

      setIsValidating(false);
    }
  };

  return (
    <PropProofLayout>
      <main className="min-h-screen bg-slate-200/60 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Wallet Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-8 h-8 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-center mb-2">
            Connect your wallet
          </h1>

          {/* Description */}
          <p className="text-center text-gray-600 mb-8">
            Enter your public wallet address to link your portfolio.
          </p>

          {/* Wallet Address Input */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Wallet Address
              </label>
              <input
                type="text"
                placeholder="0x... or solana address"
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-mono text-sm"
                value={walletAddress}
                onChange={(e) => {
                  setWalletAddress(e.target.value);
                  setError("");
                }}
                disabled={isLoading}
              />
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
            </div>
          </div>

          {/* Link Wallet Button */}
          <button
            className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleLinkWallet}
            disabled={isLoading || isValidating || !walletAddress.trim()}
          >
            {isLoading || isValidating ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                {isValidating ? "Validating..." : "Processing..."}
              </>
            ) : (
              <>
                Link Wallet
                <svg
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </>
            )}
          </button>

          {/* Change onboarding path link */}
          <div className="mt-6 text-center">
            <Link
              href={config.auth.loginUrl}
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
    </PropProofLayout>
  );
}
