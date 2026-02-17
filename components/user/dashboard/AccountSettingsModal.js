"use client";

import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Account Settings Modal Component
 * Allows users to edit their profile information
 */
export default function AccountSettingsModal({ isOpen, onClose, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    display_name: "",
    bio: "",
    handle: "",
    wallet_address: "",
    twitter: "",
    youtube: "",
  });
  const [originalData, setOriginalData] = useState(null);

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

      // Get profile data
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const initialData = {
        display_name: profile?.display_name || user.user_metadata?.name || user.email?.split("@")[0] || "",
        bio: profile?.bio || "",
        handle: profile?.handle || user.email?.split("@")[0]?.toLowerCase() || "",
        wallet_address: profile?.wallet_address || "",
        twitter: profile?.twitter || "",
        youtube: profile?.youtube || "",
      };

      setFormData(initialData);
      setOriginalData(initialData);
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDiscard = () => {
    if (originalData) {
      setFormData(originalData);
    }
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Check if wallet address is being added/changed
    const isWalletChanging = formData.wallet_address &&
      formData.wallet_address !== originalData?.wallet_address;

    try {
      const response = await fetch("/api/user/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          display_name: formData.display_name,
          bio: formData.bio,
          handle: formData.handle || null,
          wallet_address: formData.wallet_address || null,
          twitter: formData.twitter || null,
          youtube: formData.youtube || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update profile");
      }

      const result = await response.json();

      // Update original data
      setOriginalData(formData);

      // Call onUpdate callback with backfill info
      if (onUpdate) {
        onUpdate(result.data, result.backfill_triggered);
      }

      onClose();
    } catch (error) {
      console.error("Error updating profile:", error);
      alert(error.message || "Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalData);

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
                      Account Settings
                    </Dialog.Title>
                    <p className="text-sm text-slate-500 mt-1 uppercase tracking-wide">
                      MANAGE YOUR IDENTITY AND PAYOUTS
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
                  {/* Display Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
                      PUBLIC DISPLAY NAME
                    </label>
                    <input
                      type="text"
                      name="display_name"
                      value={formData.display_name}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Enter your display name"
                    />
                  </div>

                  {/* Handle */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
                      HANDLE (USERNAME)
                    </label>
                    <input
                      type="text"
                      name="handle"
                      value={formData.handle}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="username"
                    />
                    <p className="text-xs text-slate-400 mt-2">
                      Your unique username (lowercase, no spaces).
                    </p>
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
                      SHORT BIO
                    </label>
                    <textarea
                      name="bio"
                      value={formData.bio}
                      onChange={handleChange}
                      rows={4}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      placeholder="Tell us about yourself..."
                    />
                  </div>

                  {/* Social Links */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
                        TWITTER
                      </label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                          <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                          </svg>
                        </div>
                        <input
                          type="url"
                          name="twitter"
                          value={formData.twitter}
                          onChange={handleChange}
                          className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="https://twitter.com/username"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
                        YOUTUBE
                      </label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                          <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                          </svg>
                        </div>
                        <input
                          type="url"
                          name="youtube"
                          value={formData.youtube}
                          onChange={handleChange}
                          className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="https://youtube.com/@username"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-4 pt-6 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleDiscard}
                      className="px-6 py-3 text-slate-700 bg-slate-100 rounded-lg font-semibold hover:bg-slate-200 transition-colors"
                      disabled={loading}
                    >
                      Discard Changes
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: '#635BFF' }}
                      onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#5a52e6')}
                      onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#635BFF')}
                      disabled={loading || !hasChanges}
                    >
                      {loading ? "Updating..." : "Update Profile"}
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
