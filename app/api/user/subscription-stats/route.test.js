/**
 * Tests for GET /api/user/subscription-stats
 */
import { GET } from "./route";
import { createClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server");

describe("GET /api/user/subscription-stats", () => {
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
      from: jest.fn(),
    };
    createClient.mockResolvedValue(mockSupabase);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await GET(new Request("https://x.com"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns subscribedCount, nextDigestDate, and firms when authenticated", async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              {
                firm_id: "f1",
                firm_profiles: { id: "f1", name: "Firm One", logo_url: null },
              },
            ],
            error: null,
          }),
        }),
      }),
    });
    const res = await GET(new Request("https://x.com"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscribedCount).toBe(1);
    expect(body.nextDigestDate).toBeDefined();
    expect(body.firms).toHaveLength(1);
    expect(body.firms[0]).toEqual({
      id: "f1",
      name: "Firm One",
      logo_url: null,
    });
  });

  it("returns 500 when subscription query fails", async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "DB error" },
          }),
        }),
      }),
    });
    const res = await GET(new Request("https://x.com"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to fetch subscription stats");
  });

  it("returns 200 with empty firms when subscriptions is null", async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    const res = await GET(new Request("https://x.com"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscribedCount).toBe(0);
    expect(body.firms).toEqual([]);
    expect(body.nextDigestDate).toBeDefined();
  });

  it("returns 500 when createClient throws", async () => {
    createClient.mockRejectedValueOnce(new Error("Connection failed"));
    const res = await GET(new Request("https://x.com"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });

  it("returns nextDigestDate when today is Sunday (branch: day === 0)", async () => {
    const sunday = new Date("2026-03-01T12:00:00.000Z");
    jest.useFakeTimers();
    jest.setSystemTime(sunday);
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });
    const res = await GET(new Request("https://x.com"));
    jest.useRealTimers();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.nextDigestDate).toBeDefined();
    expect(new Date(body.nextDigestDate).getUTCDay()).toBe(0);
  });
});
