/**
 * Tests for GET /api/trader/[handle]
 */
import { GET } from "./route";
import { createClient } from "@supabase/supabase-js";
import { getAllTraderTransactions } from "@/lib/services/traderDataLoader";
import { calculateStats } from "@/lib/transactionProcessor";

jest.mock("@supabase/supabase-js");
jest.mock("@/lib/services/traderDataLoader");
jest.mock("@/lib/transactionProcessor");

describe("GET /api/trader/[handle]", () => {
  let mockFrom;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    mockFrom = jest.fn();
    createClient.mockReturnValue({ from: mockFrom });
  });

  it("returns 400 when handle is missing", async () => {
    const res = await GET(new Request("https://x.com"), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Handle parameter is required");
  });

  it("returns 404 when profile not found", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        ilike: jest.fn().mockReturnValue({
          not: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    });
    const res = await GET(new Request("https://x.com"), {
      params: Promise.resolve({ handle: "nobody" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Trader not found");
  });

  it("returns 500 when user_profiles fetch errors", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        ilike: jest.fn().mockReturnValue({
          not: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
            }),
          }),
        }),
      }),
    });
    const res = await GET(new Request("https://x.com"), {
      params: Promise.resolve({ handle: "alice" }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch trader");
  });

  it("returns trader with stats from trader_records when available", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        ilike: jest.fn().mockReturnValue({
          not: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: "u1",
                    display_name: "Alice",
                    handle: "alice",
                    wallet_address: "0xabc",
                    bio: null,
                    twitter: null,
                    instagram: null,
                    youtube: null,
                    created_at: "2025-01-01T00:00:00Z",
                    trader_records: [
                      {
                        total_payout_usd: 3000,
                        last_30_days_payout_usd: 500,
                        avg_payout_usd: 300,
                        payout_count: 10,
                        last_synced_at: "2025-02-01T00:00:00Z",
                      },
                    ],
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      }),
    });
    const res = await GET(new Request("https://x.com"), {
      params: Promise.resolve({ handle: "alice" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trader.displayName).toBe("Alice");
    expect(body.trader.handle).toBe("alice");
    expect(body.trader.totalVerifiedPayout).toBe(3000);
    expect(body.trader.payoutCount).toBe(10);
    expect(getAllTraderTransactions).not.toHaveBeenCalled();
  });

  it("returns trader with stats from getAllTraderTransactions when no trader_records", async () => {
    const jsonTxs = [
      {
        tx_hash: "0x2",
        timestamp: new Date().toISOString(),
        from_address: "0xfrom",
        to_address: "0xdef",
        amount: 150,
        token: "USDC",
      },
    ];
    getAllTraderTransactions.mockResolvedValue(jsonTxs);
    calculateStats.mockReturnValue({
      totalPayoutUSD: 150,
      avgPayoutUSD: 150,
      totalTransactions: 1,
    });
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        ilike: jest.fn().mockReturnValue({
          not: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: "u1",
                    display_name: "Dave",
                    handle: "dave",
                    wallet_address: "0xdef",
                    bio: null,
                    twitter: null,
                    instagram: null,
                    youtube: null,
                    created_at: "2025-01-01T00:00:00Z",
                    trader_records: [{ total_payout_usd: 0 }],
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      }),
    });
    const res = await GET(new Request("https://x.com"), {
      params: Promise.resolve({ handle: "dave" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trader.totalVerifiedPayout).toBe(150);
    expect(body.trader.payoutCount).toBe(1);
  });

  it("returns trader with 0 stats when no trader_records and no JSON data", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        ilike: jest.fn().mockReturnValue({
          not: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: "u1",
                    display_name: "Bob",
                    handle: "bob",
                    wallet_address: "0xdef",
                    bio: null,
                    twitter: null,
                    instagram: null,
                    youtube: null,
                    created_at: "2025-01-01T00:00:00Z",
                    trader_records: null,
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      }),
    });
    getAllTraderTransactions.mockResolvedValue([]);
    const res = await GET(new Request("https://x.com"), {
      params: Promise.resolve({ handle: "bob" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.trader.totalVerifiedPayout).toBe(0);
    expect(body.trader.payoutCount).toBe(0);
  });

  it("returns 500 when handler throws", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("Unexpected");
    });
    const res = await GET(new Request("https://x.com"), {
      params: Promise.resolve({ handle: "alice" }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });
});
