/**
 * Tests for GET /api/auth/callback (OAuth callback)
 */
import { GET } from "./route";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import config from "@/config";

jest.mock("@/lib/supabase/server");
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));
jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));
jest.mock("@/config", () => ({
  __esModule: true,
  default: { auth: { callbackUrl: "/dashboard" } },
}));
jest.mock("child_process", () => ({
  exec: jest.fn((cmd, opts, cb) => {
    const done = typeof opts === "function" ? opts : cb;
    if (done) done(null, "", "");
  }),
}));

describe("/api/auth/callback", () => {
  let mockSupabase;
  let mockCookieStore;
  let mockServiceClient;
  /** Captured return value of from("profiles") so we can assert on .upsert / .update */
  let profilesChain;

  beforeEach(() => {
    jest.clearAllMocks();
    profilesChain = null;
    mockSupabase = {
      auth: {
        exchangeCodeForSession: jest.fn(),
      },
    };
    createClient.mockResolvedValue(mockSupabase);
    mockCookieStore = {
      get: jest.fn().mockReturnValue(undefined),
      delete: jest.fn(),
    };
    cookies.mockResolvedValue(mockCookieStore);
    mockServiceClient = {
      from: jest.fn((table) => {
        if (table === "profiles") {
          return profilesChain;
        }
        return {};
      }),
    };
    createServiceClient.mockReturnValue(mockServiceClient);
  });

  /** Set up default profilesChain (no existing profile). Tests can override select. */
  function setProfilesChainNoProfile() {
    profilesChain = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: {}, error: null }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    };
  }

  /** Set up profilesChain with existing profile (optional wallet). */
  function setProfilesChainExisting(data) {
    profilesChain = {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data, error: null }),
        }),
      }),
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: {}, error: null }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    };
  }

  function createRequest(url = "https://app.com/api/auth/callback") {
    return new Request(url);
  }

  it("redirects to callbackUrl when no code parameter", async () => {
    const res = await GET(createRequest("https://app.com/api/auth/callback"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
    expect(mockSupabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("redirects to next param when provided", async () => {
    const res = await GET(
      createRequest("https://app.com/api/auth/callback?next=/user/settings")
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/user/settings");
  });

  it("redirects when exchangeCodeForSession returns error", async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "invalid code" },
    });
    const res = await GET(
      createRequest("https://app.com/api/auth/callback?code=badcode")
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
  });

  it("redirects when exchangeCodeForSession returns no session", async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    const res = await GET(
      createRequest("https://app.com/api/auth/callback?code=xyz")
    );
    expect(res.status).toBe(307);
  });

  it("creates new profile and redirects when session exists and no profile", async () => {
    setProfilesChainNoProfile();
    const userId = "user-new-123";
    const userEmail = "new@example.com";
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: {
        session: {
          user: {
            id: userId,
            email: userEmail,
            user_metadata: { full_name: "New User" },
          },
        },
      },
      error: null,
    });
    mockCookieStore.get.mockReturnValue(undefined);

    const res = await GET(
      createRequest("https://app.com/api/auth/callback?code=valid")
    );
    expect(res.status).toBe(307);
    expect(profilesChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: userId,
        email: userEmail,
        display_name: "New User",
        handle: "new",
      }),
      expect.any(Object)
    );
  });

  it("creates new profile with wallet from cookie and redirects", async () => {
    setProfilesChainNoProfile();
    const userId = "user-wallet-456";
    const wallet = "0x1234567890123456789012345678901234567890";
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: {
        session: {
          user: {
            id: userId,
            email: "wallet@example.com",
            user_metadata: {},
          },
        },
      },
      error: null,
    });
    mockCookieStore.get.mockReturnValue({ value: wallet });
    process.env.ARBISCAN_API_KEY = "test-key";

    const res = await GET(
      createRequest("https://app.com/api/auth/callback?code=valid")
    );
    await new Promise((r) => setImmediate(r));
    expect(res.status).toBe(307);
    expect(profilesChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: userId,
        wallet_address: wallet,
      }),
      expect.any(Object)
    );
    expect(res.headers.get("location")).toContain("wallet_linked=true");
  });

  it("updates existing profile with wallet from cookie", async () => {
    const userId = "user-existing-789";
    const wallet = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    setProfilesChainExisting({
      id: userId,
      wallet_address: null,
      display_name: null,
      handle: null,
    });
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: {
        session: {
          user: {
            id: userId,
            email: "existing@example.com",
            user_metadata: { name: "Existing" },
          },
        },
      },
      error: null,
    });
    mockCookieStore.get.mockReturnValue({ value: wallet });
    process.env.ARBISCAN_API_KEY = "test-key";

    const res = await GET(
      createRequest("https://app.com/api/auth/callback?code=valid")
    );
    await new Promise((r) => setImmediate(r));
    expect(res.status).toBe(307);
    expect(profilesChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        wallet_address: wallet,
        updated_at: expect.any(String),
      })
    );
  });

  it("deletes pending_wallet cookie on response", async () => {
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    const res = await GET(
      createRequest("https://app.com/api/auth/callback?code=x")
    );
    expect(res.status).toBe(307);
    expect(mockCookieStore.delete).toHaveBeenCalledWith("pending_wallet");
  });

  it("handles profile check error and still redirects", async () => {
    setProfilesChainNoProfile();
    profilesChain.select.mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "profile check failed" },
        }),
      }),
    });
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: {
        session: {
          user: {
            id: "user-err",
            email: "err@example.com",
            user_metadata: {},
          },
        },
      },
      error: null,
    });

    const res = await GET(
      createRequest("https://app.com/api/auth/callback?code=valid")
    );
    expect(res.status).toBe(307);
  });

  it("triggerBackfill runs and update is called when exec resolves", async () => {
    setProfilesChainNoProfile();
    process.env.ARBISCAN_API_KEY = "key";
    const userId = "user-backfill-123";
    const wallet = "0x1234567890123456789012345678901234567890";
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: userId, email: "bf@x.com", user_metadata: {} },
        },
      },
      error: null,
    });
    mockCookieStore.get.mockReturnValue({ value: wallet });
    const res = await GET(
      createRequest("https://app.com/api/auth/callback?code=valid")
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(res.status).toBe(307);
    expect(profilesChain.upsert).toHaveBeenCalled();
  });

  it("handles existing profile with wallet already set", async () => {
    const userId = "user-has-wallet";
    const wallet = "0x1111111111111111111111111111111111111111";
    setProfilesChainExisting({
      id: userId,
      wallet_address: wallet,
      display_name: "User",
      handle: "user",
    });
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: userId, email: "u@x.com", user_metadata: {} },
        },
      },
      error: null,
    });
    mockCookieStore.get.mockReturnValue({ value: wallet });

    const res = await GET(
      createRequest("https://app.com/api/auth/callback?code=valid")
    );
    expect(res.status).toBe(307);
    expect(profilesChain.update).not.toHaveBeenCalled();
  });
});
