import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const DEFAULT_CHANNELS = [
  { channel_id: "UCkgCjFPlUbOLPxMGLQlNS5w", channel_name: "FundedNext",            category: "prop_firm_official" },
  { channel_id: "UCW3_q_GFRMeldAFy0TW0LGg", channel_name: "FTMO",                  category: "prop_firm_official" },
  { channel_id: "UCp9gCQzMZXTXE1ZmDTmBrSA", channel_name: "The5ers",               category: "prop_firm_official" },
  { channel_id: "UCTy0VCCH9aSgKdpD2RBoFhg", channel_name: "TopstepTV",             category: "prop_firm_official" },
  { channel_id: "UC5nVPP3zKT9d7aJlEyB3uFg", channel_name: "FundingPips",           category: "prop_firm_official" },
  { channel_id: "UCO_WT9i6YMmYMmh0sLgq80w", channel_name: "Apex Trader Funding",   category: "prop_firm_official" },
  { channel_id: "UC8JD3apZAFBb_OStVq_Wm3g", channel_name: "Earn2Trade",            category: "prop_firm_official" },
  { channel_id: "UCf6-7VuMxaS7zWuPz_pVVjw", channel_name: "True Forex Funds",      category: "prop_firm_official" },
  { channel_id: "UCzmNNRdopK_VilGHLwzJJXg", channel_name: "BluFX Trading",         category: "prop_firm_official" },
  { channel_id: "UCn4FWyY1M4MH-JN0SWFk5VA", channel_name: "Those Who Trade",       category: "prop_firm_review" },
  { channel_id: "UC3YF4BO0C5LUfNRVy9HkxRQ", channel_name: "Prop Firm Reviews",     category: "prop_firm_review" },
  { channel_id: "UCCEgn0AjHSGHREJNK6Nt8Vg", channel_name: "Funded Trader Reviews", category: "prop_firm_review" },
  { channel_id: "UCMibFmNmVEDXpuITJ82GWsA", channel_name: "The Funded Trader HQ",  category: "prop_firm_review" },
  { channel_id: "UCvJJ_dzjViJCoLf5uKUTwoA", channel_name: "CNBC",                  category: "industry_news" },
  { channel_id: "UCIALMKvObZNtJ6AmdCLP7Lg", channel_name: "Bloomberg Markets",     category: "industry_news" },
  { channel_id: "UCT3d9BBSMgEXHJnJ3HQCEDA", channel_name: "Reuters",               category: "industry_news" },
  { channel_id: "UCCmBLOMNaEK-WdLE4eLhbSQ", channel_name: "Real Vision Finance",   category: "industry_news" },
  { channel_id: "UCVHyfQSGWA9mkrO4Y5ZKK6Q", channel_name: "Macro Voices",          category: "industry_news" },
  { channel_id: "UC0ICUPv4vbHBHNR2VlAqHcA", channel_name: "Tasty Trade",           category: "industry_news" },
];

const DEFAULT_KEYWORDS = [
  "prop firm trading 2024",
  "funded trader review",
  "prop firm challenge",
  "forex prop firm",
  "futures prop firm",
  "FTMO review",
  "funded trading account",
  "best prop firm 2024",
  "prop firm payout",
  "trading challenge tips",
];

export async function POST() {
  try {
    const supabase = createServiceClient();

    const [chRes, kwRes] = await Promise.all([
      supabase
        .from("youtube_channels")
        .upsert(DEFAULT_CHANNELS, { onConflict: "channel_id", ignoreDuplicates: true }),
      supabase
        .from("youtube_keywords")
        .upsert(
          DEFAULT_KEYWORDS.map((keyword) => ({ keyword })),
          { onConflict: "keyword", ignoreDuplicates: true }
        ),
    ]);

    if (chRes.error) return NextResponse.json({ error: chRes.error.message }, { status: 500 });
    if (kwRes.error) return NextResponse.json({ error: kwRes.error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
