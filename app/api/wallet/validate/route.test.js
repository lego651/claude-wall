/**
 * Tests for POST /api/wallet/validate
 */
import { POST } from "./route";
import { createClient } from "@supabase/supabase-js";

jest.mock("@supabase/supabase-js");
jest.mock("fs", () => ({ readFileSync: jest.fn(() => JSON.stringify({ firms: [{ addresses: ["0xprop1"] }] })) }));

describe("POST /api/wallet/validate", () => {
  let mockFrom;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    mockFrom = jest.fn();
    createClient.mockReturnValue({ from: mockFrom });
  });

  it("returns 400 when body is invalid JSON", async () => {
    const res = await POST(
      new Request("https://x.com", { method: "POST", body: "not json" })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.error).toBe("Invalid request body");
  });

  it("returns 400 when wallet_address is missing", async () => {
    const res = await POST(
      new Request("https://x.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Wallet address is required");
  });

  it("returns 400 when wallet format is invalid", async () => {
    const res = await POST(
      new Request("https://x.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: "bad" }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("format");
  });

  it("returns 400 when wallet is prop firm address", async () => {
    const fs = require("fs");
    fs.readFileSync.mockReturnValueOnce(
      JSON.stringify({ firms: [{ addresses: ["0x1234567890123456789012345678901234567890"] }] })
    );
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    const res = await POST(
      new Request("https://x.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: "0x1234567890123456789012345678901234567890" }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("prop_firm");
  });

  it("returns valid true when wallet not in use", async () => {
    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      return {
        select: jest.fn().mockReturnValue({
          not: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });
    const res = await POST(
      new Request("https://x.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: "0x1234567890123456789012345678901234567890" }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.message).toContain("available");
  });

  it("returns valid true when wallet belongs to current_user_id", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: "user-1", email: "u@test.com", wallet_address: "0x1234567890123456789012345678901234567890" },
            error: null,
          }),
        }),
      }),
    });
    const res = await POST(
      new Request("https://x.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: "0x1234567890123456789012345678901234567890",
          current_user_id: "user-1",
        }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
  });

  it("returns 400 when wallet already used by another user", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: "other-user", email: "o@test.com", wallet_address: "0x1234567890123456789012345678901234567890" },
            error: null,
          }),
        }),
      }),
    });
    const res = await POST(
      new Request("https://x.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: "0x1234567890123456789012345678901234567890",
          current_user_id: "user-1",
        }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.reason).toBe("already_used");
  });

  it("returns valid true for Solana-style address format", async () => {
    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      return {
        select: jest.fn().mockReturnValue({
          not: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });
    const solanaAddress = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
    const res = await POST(
      new Request("https://x.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: solanaAddress }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
  });

  it("continues when propfirms.json read fails", async () => {
    const fs = require("fs");
    fs.readFileSync.mockImplementationOnce(() => {
      throw new Error("ENOENT");
    });
    let fromCallCount = 0;
    mockFrom.mockImplementation(() => {
      fromCallCount++;
      if (fromCallCount === 1) {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      return {
        select: jest.fn().mockReturnValue({
          not: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });
    const res = await POST(
      new Request("https://x.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: "0x1234567890123456789012345678901234567890" }),
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).valid).toBe(true);
  });

  it("returns 500 when check fails", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
        }),
      }),
    });
    const res = await POST(
      new Request("https://x.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: "0x1234567890123456789012345678901234567890" }),
      })
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Failed to validate wallet address");
  });
});
