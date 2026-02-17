/**
 * Tests for GET and POST /api/user/profile
 */
import { GET, POST } from "./route";
import { createClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server");
jest.mock("fs", () => ({
  readFileSync: jest.fn(() =>
    JSON.stringify({
      firms: [
        { addresses: ["0xprop1"] },
        { addresses: ["0xprop2"] },
      ],
    })
  ),
}));

describe("/api/user/profile", () => {
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1", email: "u@test.com" } } }),
      },
      from: jest.fn(),
    };
    createClient.mockResolvedValue(mockSupabase);
  });

  describe("GET", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await GET(new Request("https://x.com"));
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns profile when user is authenticated", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: "user-1", display_name: "Test", handle: "test" },
              error: null,
            }),
          }),
        }),
      });
      const res = await GET(new Request("https://x.com"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual({ id: "user-1", display_name: "Test", handle: "test" });
    });

    it("returns null data when profile not found (PGRST116)", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116" },
            }),
          }),
        }),
      });
      const res = await GET(new Request("https://x.com"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toBeNull();
    });

    it("returns 500 when profile fetch returns non-PGRST116 error", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: "OTHER", message: "DB error" },
            }),
          }),
        }),
      });
      const res = await GET(new Request("https://x.com"));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Failed to load profile");
    });
  });

  describe("POST", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
      const res = await POST(
        new Request("https://x.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ display_name: "Test" }),
        })
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 400 when handle is too short", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            neq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      });
      const res = await POST(
        new Request("https://x.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle: "ab" }),
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Handle must be at least 3 characters long");
    });

    it("returns 400 when handle is already taken", async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === "user_profiles") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                neq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: "other-user" },
                    error: null,
                  }),
                }),
              }),
            }),
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { wallet_address: null, backfilled_at: null },
                error: null,
              }),
            }),
          };
        }
        return {};
      });
      const res = await POST(
        new Request("https://x.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle: "taken" }),
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("This handle is already taken. Please choose another.");
    });

    it("returns 400 when wallet address format is invalid", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            single: jest.fn().mockResolvedValue({
              data: { wallet_address: null },
              error: null,
            }),
          }),
        }),
      });
      const res = await POST(
        new Request("https://x.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet_address: "invalid" }),
        })
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid wallet address format");
    });

    it("returns 200 and success when upsert succeeds", async () => {
      let fromCallCount = 0;
      mockSupabase.from.mockImplementation(() => {
        fromCallCount += 1;
        if (fromCallCount === 1) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                neq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        if (fromCallCount === 2) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { wallet_address: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {
          upsert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: "user-1", display_name: "Updated" },
                error: null,
              }),
            }),
          }),
        };
      });
      global.fetch = jest.fn().mockResolvedValue({ ok: true });
      const res = await POST(
        new Request("https://x.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            display_name: "Updated",
            handle: "myhandle",
          }),
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.display_name).toBe("Updated");
    });

    it("returns 200 and includes backfill_triggered when new wallet is added", async () => {
      let fromCallCount = 0;
      mockSupabase.from.mockImplementation((table) => {
        if (table !== "user_profiles") return {};
        fromCallCount += 1;
        if (fromCallCount === 1) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                neq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        if (fromCallCount === 2) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { wallet_address: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (fromCallCount === 3) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                neq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return {
          upsert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: "user-1", wallet_address: "0x1234567890123456789012345678901234567890" },
                error: null,
              }),
            }),
          }),
        };
      });
      global.fetch = jest.fn().mockResolvedValue({ ok: true });
      const res = await POST(
        new Request("https://x.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            display_name: "New",
            handle: "newuser",
            wallet_address: "0x1234567890123456789012345678901234567890",
          }),
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.backfill_triggered).toBe(true);
    });

    it("returns 500 when upsert fails", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            single: jest.fn().mockResolvedValue({
              data: { wallet_address: null },
              error: null,
            }),
          }),
        }),
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: "Constraint violation" },
            }),
          }),
        }),
      });
      const res = await POST(
        new Request("https://x.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ display_name: "Test" }),
        })
      );
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("Failed to save profile");
    });
  });
});
