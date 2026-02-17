/**
 * Tests for POST /api/user/create-profile
 */
import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server");

describe("POST /api/user/create-profile", () => {
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "user-1", email: "u@test.com" } } }) },
      from: jest.fn(),
    };
    createClient.mockResolvedValue(mockSupabase);
  });

  it("returns 401 when user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const res = await POST(new Request("https://x.com", { method: "POST" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns message and data when profile already exists", async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: "user-1" },
            error: null,
          }),
        }),
      }),
    });
    const res = await POST(new Request("https://x.com", { method: "POST" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Profile already exists");
    expect(body.data).toEqual({ id: "user-1" });
  });

  it("returns 200 and creates profile when none exists", async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === "user_profiles") {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: "user-1", email: "u@test.com" },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });
    const res = await POST(new Request("https://x.com", { method: "POST" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Profile created successfully");
    expect(body.data).toEqual({ id: "user-1", email: "u@test.com" });
  });

  it("returns 500 when insert fails", async () => {
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "Constraint violation" },
          }),
        }),
      }),
    });
    const res = await POST(new Request("https://x.com", { method: "POST" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to create profile");
  });

  it("returns 500 when handler throws", async () => {
    mockSupabase.from.mockImplementation(() => {
      throw new Error("Unexpected");
    });
    const res = await POST(new Request("https://x.com", { method: "POST" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });
});
