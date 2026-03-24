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
        onClick={handleClick}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-gray-900 text-white font-bold text-sm px-5 py-3 rounded-2xl shadow-lg hover:bg-gray-700 hover:-translate-y-0.5 transition-all duration-200"
        aria-label="Log a trade"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Log Trade
      </button>

      {open && <TradeLogModal onClose={() => setOpen(false)} onSaved={onTradeLogged} />}
    </>
  );
}
