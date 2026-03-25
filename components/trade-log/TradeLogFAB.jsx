"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import TradeLogModal from "./TradeLogModal";

export default function TradeLogFAB({ onTradeLogged }) {
  const [open, setOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, []);

  function handleClick() {
    if (!isLoggedIn) {
      router.push("/signin");
      return;
    }
    setOpen(true);
  }

  return (
    <>
      <button
        data-fab
        onClick={handleClick}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-base px-6 py-3.5 rounded-full shadow-xl hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        aria-label="Log a trade"
      >
        <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </span>
        Log New Trade
      </button>

      {open && <TradeLogModal onClose={() => setOpen(false)} onSaved={onTradeLogged} />}
    </>
  );
}
