"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * Reusable User Profile Card Component
 * Displays user avatar, name, handle, bio, social links, and stats
 */
export default function UserProfileCard({ 
  displayName, 
  handle, 
  avatarUrl, 
  bio, 
  socialLinks = {},
  payoutCount = 0,
  successRate = 0,
  memberSince,
  trustScore = 98
}) {
  const [imageError, setImageError] = useState(false);
  const initials = displayName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-6">
          {avatarUrl && !imageError ? (
            <Image
              src={avatarUrl}
              alt={displayName || "User"}
              width={128}
              height={128}
              className="w-28 h-28 rounded-3xl object-cover bg-slate-100 shadow-lg"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
              <span className="text-4xl font-bold text-white">
                {initials}
              </span>
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-1 rounded-full border-3 border-white shadow-md">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900 mb-1">{displayName || "User"}</h1>
        {handle && (
          <p className="font-semibold text-sm mb-6" style={{ color: '#635BFF' }}>@{handle}</p>
        )}

        {bio && (
          <p className="text-sm text-slate-600 mb-8 leading-relaxed">{bio}</p>
        )}

        <div className="flex gap-3 mb-8">
          {socialLinks.twitter && (
            <a
              href={socialLinks.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 bg-slate-50 rounded-lg hover:bg-slate-900 hover:text-white transition-all"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
              </svg>
            </a>
          )}
          {socialLinks.youtube && (
            <a
              href={socialLinks.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 bg-slate-50 rounded-lg hover:bg-slate-900 hover:text-white transition-all"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
          )}
          <a
            href="#"
            className="p-2.5 bg-slate-50 rounded-lg hover:bg-slate-900 hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>

        <div className="w-full pt-6 border-t border-slate-100 space-y-5 text-left">
          {memberSince && (
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span>Member since</span>
              </div>
              <span className="font-bold text-slate-900">{memberSince}</span>
            </div>
          )}

          {payoutCount >= 0 && (
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
                <span>Payout count</span>
              </div>
              <span className="font-bold text-slate-900">{payoutCount} verified</span>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2 text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
                <span>Trust score</span>
              </div>
              <span className="font-bold text-emerald-600">{trustScore}/100</span>
            </div>
            <p className="text-[10px] text-slate-400 -mt-0.5">Share of received funds from verified prop firms</p>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, trustScore)}%` }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
