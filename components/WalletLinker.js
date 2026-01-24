"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/libs/supabase/client";

// Component to link wallet address from sessionStorage after OAuth redirect
// This handles the case where OAuth providers strip query parameters
export default function WalletLinker() {
  const router = useRouter();
  const [isLinking, setIsLinking] = useState(false);
  const [linkStatus, setLinkStatus] = useState(null); // 'success' | 'error' | null

  useEffect(() => {
    const linkWallet = async () => {
      // Check if there's a pending wallet in sessionStorage
      if (typeof window === "undefined") return;

      const pendingWallet = sessionStorage.getItem("pending_wallet_address");
      if (!pendingWallet) return;

      // Check if user is authenticated
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // User not authenticated yet, wait a bit and try again
        setTimeout(linkWallet, 1000);
        return;
      }

      setIsLinking(true);
      console.log("🔗 Attempting to link wallet:", pendingWallet);

      try {
        // Call API to link wallet
        const response = await fetch("/api/user/link-wallet", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ wallet_address: pendingWallet }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          console.log("✅ Wallet linked successfully:", pendingWallet);
          setLinkStatus("success");
          // Remove from sessionStorage
          sessionStorage.removeItem("pending_wallet_address");
          
          // Update URL to show success
          const url = new URL(window.location.href);
          url.searchParams.set("wallet_linked", "true");
          router.replace(url.pathname + url.search, { scroll: false });
        } else {
          console.error("❌ Failed to link wallet:", data.error);
          setLinkStatus("error");
        }
      } catch (error) {
        console.error("❌ Error linking wallet:", error);
        setLinkStatus("error");
      } finally {
        setIsLinking(false);
      }
    };

    // Small delay to ensure auth state is ready
    const timer = setTimeout(linkWallet, 500);
    return () => clearTimeout(timer);
  }, [router]);

  // This component doesn't render anything, it just handles the linking
  return null;
}
