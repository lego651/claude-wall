"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// Component to show confirmation and cleanup after wallet linking
export default function WalletLinkConfirmation() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    // Check if wallet was just linked
    const walletLinked = searchParams.get("wallet_linked");
    
    if (walletLinked === "true") {
      // Clean up sessionStorage
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("pending_wallet_address");
      }
      
      setShowConfirmation(true);
      
      // Remove query parameter from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete("wallet_linked");
      router.replace(url.pathname, { scroll: false });
      
      // Hide confirmation after 5 seconds
      const timer = setTimeout(() => {
        setShowConfirmation(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  if (!showConfirmation) return null;

  return (
    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-start gap-3">
        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center shrink-0 mt-0.5">
          <svg
            className="w-3 h-3 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-green-900 mb-1">
            Verification Ready!
          </p>
          <p className="text-xs text-green-700">
            Your wallet address has been successfully linked to your account.
          </p>
        </div>
        <button
          onClick={() => setShowConfirmation(false)}
          className="text-green-600 hover:text-green-800 shrink-0"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
