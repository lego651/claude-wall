/**
 * Tests for GET /api/leaderboard
 */
import { GET } from "./route";
import { createClient } from "@supabase/supabase-js";
import { getAllTraderTransactions } from "@/lib/services/traderDataLoader";
import { calculateStats } from "@/lib/transactionProcessor";

jest.mock("@supabase/supabase-js");
jest.mock("@/lib/services/traderDataLoader");
jest.mock("@/lib/transactionProcessor");

describe("GET /api/leaderboard", () => {
  let mockFrom;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    mockFrom = jest.fn();
    createClient.mockReturnValue({ from: mockFrom });
  });

  it("returns traders empty when Supabase env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.traders).toEqual([]);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("returns 500 when user_profiles fetch fails", async () => {
    mockFrom.mockImplementation((table) => {
      if (table === "user_profiles") {
        return {
          select: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
              }),
            }),
          }),
        };
      }
      return {};
    });
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch profiles");
  });

  it("returns traders empty when no profiles", async () => {
    mockFrom.mockImplementation((table) => {
      if (table === "user_profiles") {
        return {
          select: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.traders).toEqual([]);
  });

  it("returns traders empty when all profiles have empty handle", async () => {
    mockFrom.mockImplementation((table) => {
      if (table === "user_profiles") {
        return {
          select: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockResolvedValue({
                  data: [{ id: "u1", display_name: "A", handle: "", wallet_address: "0xabc" }],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.traders).toEqual([]);
  });

  it("returns traders with stats from trader_records when available", async () => {
    mockFrom.mockImplementation((table) => {
      if (table === "user_profiles") {
        return {
          select: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: "u1",
                      display_name: "Alice",
                      handle: "alice",
                      wallet_address: "0xabc123",
                      created_at: "2025-01-01T00:00:00Z",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "trader_records") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: {
                  total_payout_usd: 5000,
                  last_30_days_payout_usd: 1000,
                  avg_payout_usd: 500,
                  payout_count: 10,
                  last_synced_at: "2025-02-01T00:00:00Z",
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.traders).toHaveLength(1);
    expect(body.traders[0].displayName).toBe("Alice");
    expect(body.traders[0].handle).toBe("alice");
    expect(body.traders[0].totalVerifiedPayout).toBe(5000);
    expect(body.traders[0].payoutCount).toBe(10);
  });

  it("returns traders with stats from getAllTraderTransactions when no trader_records", async () => {
    const jsonTxs = [
      {
        tx_hash: "0x1",
        timestamp: new Date().toISOString(),
        from_address: "0xfrom",
        to_address: "0xabc123",
        amount: 200,
        token: "USDC",
      },
    ];
    getAllTraderTransactions.mockResolvedValue(jsonTxs);
    calculateStats.mockReturnValue({
      totalPayoutUSD: 200,
      avgPayoutUSD: 200,
      totalTransactions: 1,
    });
    mockFrom.mockImplementation((table) => {
      if (table === "user_profiles") {
        return {
          select: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: "u1",
                      display_name: "Charlie",
                      handle: "charlie",
                      wallet_address: "0xabc123",
                      created_at: "2025-01-01T00:00:00Z",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "trader_records") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      return {};
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.traders).toHaveLength(1);
    expect(body.traders[0].totalVerifiedPayout).toBe(200);
    expect(body.traders[0].payoutCount).toBe(1);
  });

  it("returns traders with 0 stats when no record and getAllTraderTransactions returns empty", async () => {
    mockFrom.mockImplementation((table) => {
      if (table === "user_profiles") {
        return {
          select: jest.fn().mockReturnValue({
            not: jest.fn().mockReturnValue({
              not: jest.fn().mockReturnValue({
                not: jest.fn().mockResolvedValue({
                  data: [
                    {
                      id: "u1",
                      display_name: "Bob",
                      handle: "bob",
                      wallet_address: "0xdef456",
                      created_at: "2025-01-01T00:00:00Z",
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "trader_records") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      return {};
    });
    getAllTraderTransactions.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.traders).toHaveLength(0);
  });

  it("returns 500 when handler throws", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("Unexpected");
    });
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });
});
