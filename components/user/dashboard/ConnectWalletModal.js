"use client";

import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Connect Wallet Modal
 * Same look as Account Settings modal, but only for connecting a wallet address.
 * Used for new signed-in users who haven't linked a wallet yet.
 */
export default function ConnectWalletModal({ isOpen, onClose, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [originalWallet, setOriginalWallet] = useState("");
  // Snapshot of other profile fields so we can send them on submit (API does full upsert)
  const [profileSnapshot, setProfileSnapshot] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadProfile();
    }
  }, [isOpen]);

  const loadProfile = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("display_name, bio, handle, twitter, instagram, youtube, wallet_address")
        .eq("id", user.id)
        .single();

      const addr = profile?.wallet_address || "";
      setWalletAddress(addr);
      setOriginalWallet(addr);
      setProfileSnapshot(profile || null);
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const handleDiscard = () => {
    setWalletAddress(originalWallet);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      display_name: profileSnapshot?.display_name ?? null,
      bio: profileSnapshot?.bio ?? null,
      handle: profileSnapshot?.handle ?? null,
      twitter: profileSnapshot?.twitter ?? null,
      instagram: profileSnapshot?.instagram ?? null,
      youtube: profileSnapshot?.youtube ?? null,
      wallet_address: walletAddress?.trim() || null,
    };

    try {
      const response = await fetch("/api/user/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update profile");
      }

      const result = await response.json();
      setOriginalWallet(walletAddress?.trim() || "");

      if (onUpdate) {
        onUpdate(result.data, result.backfill_triggered);
      }

      onClose();
    } catch (error) {
      console.error("Error connecting wallet:", error);
      alert(error.message || "Failed to connect wallet. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = (walletAddress?.trim() || "") !== (originalWallet?.trim() || "");

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-8 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <Dialog.Title as="h2" className="text-2xl font-bold text-slate-900">
                      Connect Wallet
                    </Dialog.Title>
                    <p className="text-sm text-slate-500 mt-1 uppercase tracking-wide">
                      LINK YOUR EVM WALLET FOR PAYOUT VERIFICATION
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
                      WALLET ADDRESS (EVM)
                    </label>
                    <input
                      type="text"
                      name="wallet_address"
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                      placeholder="0x..."
                    />
                    <p className="text-xs text-slate-400 mt-2">
                      This address is used for automated verification of on-chain payouts. We'll sync your transaction history after you save.
                    </p>
                  </div>

                  <div className="flex justify-end gap-4 pt-6 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleDiscard}
                      className="px-6 py-3 text-slate-700 bg-slate-100 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#635BFF' }}
                      onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#5a52e6')}
                      onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#635BFF')}
                      disabled={loading || !hasChanges}
                    >
                      {loading ? "Saving..." : "Connect Wallet"}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
