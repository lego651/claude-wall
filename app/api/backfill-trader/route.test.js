/**
 * Tests for GET and POST /api/backfill-trader
 */
import { GET, POST } from "./route";
import { createClient } from "@/lib/supabase/server";
import { exec } from "child_process";

jest.mock("@/lib/supabase/server");
jest.mock("child_process", () => ({
  exec: jest.fn(),
}));

describe("/api/backfill-trader", () => {
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: jest.fn(),
    };
    createClient.mockResolvedValue(mockSupabase);
    exec.mockImplementation((cmd, opts, cb) => {
      const done = typeof opts === "function" ? opts : cb;
      if (done) done(null, "", "");
    });
  });

  describe("POST", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await POST(
        new Request("https://x.com", {
          method: "POST",
          body: JSON.stringify({ wallet_address: "0x1234567890123456789012345678901234567890" }),
        })
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 400 when wallet_address is missing", async () => {
      const res = await POST(
        new Request("https://x.com", { method: "POST", body: JSON.stringify({}) })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid wallet address format");
    });

    it("returns 400 when wallet_address format is invalid", async () => {
      const res = await POST(
        new Request("https://x.com", {
          method: "POST",
          body: JSON.stringify({ wallet_address: "not-a-wallet" }),
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid wallet address format");
    });

    it("returns 403 when wallet does not belong to user", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { wallet_address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
              error: null,
            }),
          }),
        }),
      });
      const res = await POST(
        new Request("https://x.com", {
          method: "POST",
          body: JSON.stringify({
            wallet_address: "0x1234567890123456789012345678901234567890",
          }),
        })
      );
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("Wallet address does not match your profile");
    });

    it("returns 500 when ARBISCAN_API_KEY is not set", async () => {
      const orig = process.env.ARBISCAN_API_KEY;
      delete process.env.ARBISCAN_API_KEY;
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { wallet_address: "0x1234567890123456789012345678901234567890" },
              error: null,
            }),
          }),
        }),
      });
      const res = await POST(
        new Request("https://x.com", {
          method: "POST",
          body: JSON.stringify({
            wallet_address: "0x1234567890123456789012345678901234567890",
          }),
        })
      );
      process.env.ARBISCAN_API_KEY = orig;
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("API configuration error");
    });

    it("returns 200 and updates backfilled_at when script succeeds", async () => {
      process.env.ARBISCAN_API_KEY = "test-key";
      mockSupabase.from.mockImplementation((table) => {
        if (table === "user_profiles") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { wallet_address: "0x1234567890123456789012345678901234567890" },
                  error: null,
                }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      });
      exec.mockImplementation((cmd, opts, cb) => {
        const done = typeof opts === "function" ? opts : cb;
        if (done) done(null, "", "");
      });
      const res = await POST(
        new Request("https://x.com", {
          method: "POST",
          body: JSON.stringify({
            wallet_address: "0x1234567890123456789012345678901234567890",
          }),
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.wallet_address).toBe("0x1234567890123456789012345678901234567890");
    });

    it("returns 504 when script times out", async () => {
      process.env.ARBISCAN_API_KEY = "test-key";
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { wallet_address: "0x1234567890123456789012345678901234567890" },
              error: null,
            }),
          }),
        }),
      });
      const timeoutError = new Error("killed");
      timeoutError.killed = true;
      exec.mockImplementation((cmd, opts, cb) => {
        const done = typeof opts === "function" ? opts : cb;
        if (done) done(timeoutError);
      });
      const res = await POST(
        new Request("https://x.com", {
          method: "POST",
          body: JSON.stringify({
            wallet_address: "0x1234567890123456789012345678901234567890",
          }),
        })
      );
      expect(res.status).toBe(504);
      const body = await res.json();
      expect(body.code).toBe("TIMEOUT");
      expect(body.error).toContain("timeout");
    });

    it("returns 500 when script execution fails", async () => {
      process.env.ARBISCAN_API_KEY = "test-key";
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { wallet_address: "0x1234567890123456789012345678901234567890" },
              error: null,
            }),
          }),
        }),
      });
      exec.mockImplementation((cmd, opts, cb) => {
        const done = typeof opts === "function" ? opts : cb;
        if (done) done(new Error("script failed"));
      });
      const res = await POST(
        new Request("https://x.com", {
          method: "POST",
          body: JSON.stringify({
            wallet_address: "0x1234567890123456789012345678901234567890",
          }),
        })
      );
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Failed to run backfill script");
    });

    it("returns 500 when profile fetch throws", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } } });
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error("db error")),
          }),
        }),
      });
      const res = await POST(
        new Request("https://x.com", {
          method: "POST",
          body: JSON.stringify({
            wallet_address: "0x1234567890123456789012345678901234567890",
          }),
        })
      );
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Internal server error");
    });
  });

  describe("GET", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await GET();
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns backfilled: false, has_wallet: false when no profile", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.backfilled).toBe(false);
      expect(body.has_wallet).toBe(false);
    });

    it("returns backfilled: true when profile has backfilled_at", async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === "user_profiles") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    wallet_address: "0x1234567890123456789012345678901234567890",
                    backfilled_at: "2025-01-15T00:00:00Z",
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
      expect(body.backfilled).toBe(true);
      expect(body.has_wallet).toBe(true);
      expect(body.backfilled_at).toBe("2025-01-15T00:00:00Z");
    });

    it("returns backfilled: false, has_wallet: false when profile has no wallet", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { wallet_address: null, backfilled_at: null },
              error: null,
            }),
          }),
        }),
      });
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.backfilled).toBe(false);
      expect(body.has_wallet).toBe(false);
    });

    it("returns backfilled: true and sets backfilled_at when trader_records has data", async () => {
      const wallet = "0x1234567890123456789012345678901234567890";
      mockSupabase.from.mockImplementation((table) => {
        if (table === "user_profiles") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { wallet_address: wallet, backfilled_at: null },
                  error: null,
                }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === "trader_records") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: { wallet_address: wallet.toLowerCase(), last_synced_at: "2025-01-14T12:00:00Z" },
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
      expect(body.backfilled).toBe(true);
      expect(body.has_wallet).toBe(true);
      expect(body.backfilled_at).toBeDefined();
    });

    it("returns backfilled: true when trader_history_payouts has data", async () => {
      const wallet = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
      mockSupabase.from.mockImplementation((table) => {
        if (table === "user_profiles") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { wallet_address: wallet, backfilled_at: null },
                  error: null,
                }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
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
        if (table === "trader_history_payouts") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [{ year_month: "2025-01" }],
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
      expect(body.backfilled).toBe(true);
      expect(body.has_wallet).toBe(true);
    });

    it("returns backfilled: false when wallet set but no data yet", async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === "user_profiles") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    wallet_address: "0x1234567890123456789012345678901234567890",
                    backfilled_at: null,
                  },
                  error: null,
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
        if (table === "trader_history_payouts") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        return {};
      });
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.backfilled).toBe(false);
      expect(body.has_wallet).toBe(true);
      expect(body.backfilled_at).toBeNull();
    });

    it("returns 500 when GET throws", async () => {
      mockSupabase.auth.getUser.mockRejectedValueOnce(new Error("auth failed"));
      const res = await GET();
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Internal server error");
    });
  });
});
