"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PropProofLayout from "@/components/PropProofLayout";

const OnboardingPage = () => {
  const [step, setStep] = useState(1);
  const [handle, setHandle] = useState("");
  const [wallet, setWallet] = useState("");
  const router = useRouter();

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else router.push(`/traders/new-trader`);
  };

  return (
    <PropProofLayout>
      <div className="max-w-xl mx-auto px-4 py-16">
      {/* Progress Indicator */}
      <div className="flex gap-2 mb-12">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-grow rounded-full transition-all duration-500 ${
              s <= step ? "bg-black" : "bg-gray-100"
            }`}
          />
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-xl">
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center">
              <div className="bg-black w-12 h-12 rounded-xl flex items-center justify-center text-white mx-auto mb-6">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-2">Claim your handle</h1>
              <p className="text-gray-500">This will be your public profile URL.</p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                  propproof.com/traders/
                </span>
                <input
                  type="text"
                  placeholder="handle"
                  className="w-full pl-44 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-black/5 focus:bg-white focus:border-black transition-all"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                />
              </div>
              <p className="text-[10px] text-gray-400 px-1">
                Handles can contain letters, numbers, and underscores.
              </p>
            </div>

            <button
              onClick={handleNext}
              disabled={!handle}
              className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
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
            </button>

            <div className="pt-6 border-t border-gray-50 text-center">
              <p className="text-xs text-gray-400 mb-4">Or sign in with</p>
              <div className="flex gap-4 justify-center">
                <button className="p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                  </svg>
                </button>
                <button className="p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                </button>
                <button className="p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="text-center">
              <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center text-blue-600 mx-auto mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-2">Connect Payout Source</h1>
              <p className="text-gray-500">Paste the public wallet address where you receive payouts.</p>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-start gap-3">
                <svg
                  className="w-[18px] h-[18px] text-blue-500 mt-0.5 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-xs text-gray-500 leading-relaxed">
                  We currently support <strong>Ethereum, Arbitrum, and Polygon</strong> wallets. Only payouts
                  from verified prop firm smart contracts will be tracked.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">
                  Wallet Address
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-black/5 focus:bg-white focus:border-black transition-all font-mono text-sm"
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px bg-gray-100 flex-grow"></div>
                <span className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">
                  or link rise
                </span>
                <div className="h-px bg-gray-100 flex-grow"></div>
              </div>

              <button className="w-full py-3 border border-gray-200 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
                Connect Rise Account
              </button>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="w-1/3 py-4 text-gray-400 font-bold hover:text-black transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                disabled={!wallet}
                className="flex-grow bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Verify & Continue
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
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="text-center">
              <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center text-green-500 mx-auto mb-6 border-4 border-green-100">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-2">Verified Successfully!</h1>
              <p className="text-gray-500">We found 12 historical payouts from 3 firms.</p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Total Payouts Found</span>
                <span className="font-bold text-black">$34,250</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Prop Firms Detected</span>
                <span className="font-bold text-black">Apex, Topstep</span>
              </div>
              <div className="h-px bg-gray-200 my-2"></div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-xs font-bold uppercase tracking-wider text-green-600">
                  Verification Active
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={handleNext}
                className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-xl shadow-black/10"
              >
                Publish Profile
              </button>

              <div className="p-4 border border-dashed border-gray-200 rounded-xl flex items-center justify-between group cursor-pointer hover:border-gray-400 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 p-2 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-500 truncate">
                    propproof.com/traders/{handle}
                  </span>
                </div>
                <span className="text-xs font-bold text-black opacity-0 group-hover:opacity-100 transition-opacity">
                  Copy
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-gray-400 text-xs mt-12">
        By continuing, you agree to our Terms of Service and Privacy Policy. <br />
        We only store public blockchain data and aggregated metadata.
      </p>
      </div>
    </PropProofLayout>
  );
};

export default OnboardingPage;
