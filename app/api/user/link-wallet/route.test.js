/**
 * Tests for POST /api/user/link-wallet
 */
import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server");
jest.mock("fs", () => ({
  readFileSync: jest.fn(() =>
    JSON.stringify({ firms: [{ addresses: ["0xprop1"] }, { addresses: [] }] })
  ),
}));

describe("POST /api/user/link-wallet", () => {
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
    const res = await POST(
      new Request("https://x.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: "0x1234567890123456789012345678901234567890" }),
      })
    );
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Unauthorized");
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
        body: JSON.stringify({ wallet_address: "invalid" }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid wallet address format");
  });

  it("returns 400 when wallet is a prop firm address", async () => {
    const fs = require("fs");
    fs.readFileSync.mockReturnValueOnce(
      JSON.stringify({ firms: [{ addresses: ["0x1234567890123456789012345678901234567890"] }] })
    );
    const res = await POST(
      new Request("https://x.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: "0x1234567890123456789012345678901234567890" }),
      })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("prop firm");
  });

  });
