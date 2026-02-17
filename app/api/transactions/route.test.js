/**
 * Tests for GET /api/transactions
 */
import { GET } from "./route";
import { createClient } from "@supabase/supabase-js";
import { getAllTraderTransactions } from "@/lib/services/traderDataLoader";

jest.mock("@supabase/supabase-js");
jest.mock("@/lib/services/traderDataLoader", () => ({
  getAllTraderTransactions: jest.fn().mockResolvedValue([]),
}));
jest.mock("@/lib/transactionProcessor", () => ({
  processTransactions: jest.fn(),
  calculateStats: jest.fn((txs) => ({
    totalPayoutUSD: txs?.reduce((s, t) => s + (t.amountUSD || 0), 0) || 0,
    avgPayoutUSD: 0,
    totalTransactions: txs?.length || 0,
  })),
  groupByMonth: jest.fn((txs) => (Array.isArray(txs) ? [] : [])),
}));

describe("GET /api/transactions", () => {
  let mockFrom;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    mockFrom = jest.fn();
    createClient.mockReturnValue({ from: mockFrom });
  });

  it("returns 400 when address parameter is missing", async () => {
    const res = await GET(new Request("https://x.com/api/transactions"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Address parameter is required");
  });

  it("returns 400 when address format is invalid", async () => {
    const res = await GET(
      new Request("https://x.com/api/transactions?address=not-an-address")
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid Ethereum address format");
  });

  it("returns empty data when no JSON and no cache", async () => {
    getAllTraderTransactions.mockResolvedValue([]);
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { code: "PGRST116" },
          }),
        }),
      }),
    });
    const res = await GET(
      new Request("https://x.com/api/transactions?address=0x1234567890123456789012345678901234567890")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.address).toBe("0x1234567890123456789012345678901234567890");
    expect(body.transactions).toEqual([]);
    expect(body.monthlyData).toEqual([]);
    expect(body.cached).toBe(false);
    expect(body.empty).toBe(true);
  });

  it("returns data from cache with monthlyData when cache fresh and JSON has transactions", async () => {
    const jsonTxs = [
      {
        tx_hash: "0xfresh",
        timestamp: new Date().toISOString(),
        from_address: "0xfrom",
        to_address: "0x1234567890123456789012345678901234567890",
        amount: 200,
        token: "USDC",
      },
    ];
    getAllTraderTransactions.mockImplementation(() => Promise.resolve(jsonTxs));
    const lastSynced = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              total_payout_usd: 200,
              last_30_days_payout_usd: 200,
              avg_payout_usd: 200,
              last_synced_at: lastSynced,
            },
            error: null,
          }),
        }),
      }),
    });
    const res = await GET(
      new Request("https://x.com/api/transactions?address=0x1234567890123456789012345678901234567890")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cached).toBe(true);
    expect(body.transactions).toHaveLength(1);
  });

  it("returns data from cache when cache is fresh", async () => {
    getAllTraderTransactions.mockResolvedValue([]);
    const lastSynced = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              total_payout_usd: 1000,
              last_30_days_payout_usd: 200,
              avg_payout_usd: 100,
              last_synced_at: lastSynced,
            },
            error: null,
          }),
        }),
      }),
    });
    const res = await GET(
      new Request("https://x.com/api/transactions?address=0x1234567890123456789012345678901234567890")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalPayoutUSD).toBe(1000);
    expect(body.cached).toBe(true);
    expect(body.lastSyncedAt).toBe(lastSynced);
  });

  it("returns empty data with cachedRecord stats when no JSON but cachedRecord exists", async () => {
    getAllTraderTransactions.mockResolvedValue([]);
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              total_payout_usd: 100,
              last_30_days_payout_usd: 50,
              avg_payout_usd: 100,
              last_synced_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            },
            error: null,
          }),
        }),
      }),
    });
    const res = await GET(
      new Request("https://x.com/api/transactions?address=0x1234567890123456789012345678901234567890")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.empty).toBe(true);
    expect(body.totalPayoutUSD).toBe(100);
    expect(body.cached).toBe(false);
  });

  it("returns error shape when handler throws", async () => {
    getAllTraderTransactions.mockRejectedValue(new Error("Boom"));
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockRejectedValue(new Error("Boom")),
        }),
      }),
    });
    const res = await GET(
      new Request("https://x.com/api/transactions?address=0x1234567890123456789012345678901234567890")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBe("Boom");
    expect(body.transactions).toEqual([]);
  });
});
