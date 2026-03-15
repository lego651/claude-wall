import { GET, POST } from "./route";

jest.mock("@/lib/supabase/service");
import { createServiceClient } from "@/lib/supabase/service";

const mockSingle = jest.fn();

// Build a chainable query that supports .select().order().order() (for GET)
// and .insert().select().single() (for POST)
function makeChain(finalResolve: unknown) {
  const chain = {
    select: jest.fn(),
    order: jest.fn(),
    insert: jest.fn(),
  };
  chain.select.mockReturnValue(chain);
  // Two chained .order() calls: first returns chain, second resolves
  chain.order.mockReturnValueOnce(chain).mockResolvedValue(finalResolve);
  chain.insert.mockReturnValue({ select: () => ({ single: mockSingle }) });
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

function mockDb(resolveValue: unknown = { data: [], error: null }) {
  const chain = makeChain(resolveValue);
  const mockFrom = jest.fn().mockReturnValue(chain);
  (createServiceClient as jest.Mock).mockReturnValue({ from: mockFrom });
  return chain;
}

describe("GET /api/admin/youtube/channels", () => {
  it("returns channels list", async () => {
    const channels = [
      { id: "1", channel_id: "UC1", channel_name: "Ch1", category: "prop_firm_official", upload_playlist_id: null, active: true },
    ];
    mockDb({ data: channels, error: null });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channels).toEqual(channels);
  });

  it("returns 500 on DB error", async () => {
    mockDb({ data: null, error: { message: "DB error" } });
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("returns 500 on thrown error", async () => {
    (createServiceClient as jest.Mock).mockImplementation(() => {
      throw new Error("boom");
    });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/admin/youtube/channels", () => {
  function makeRequest(body: unknown) {
    return new Request("http://localhost/api/admin/youtube/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 400 if fields missing", async () => {
    mockDb();
    const res = await POST(makeRequest({ channel_id: "UC1" }));
    expect(res.status).toBe(400);
  });

  it("returns 201 on success", async () => {
    mockDb();
    const newCh = { id: "1", channel_id: "UC1", channel_name: "Ch1", category: "prop_firm_official" };
    mockSingle.mockResolvedValue({ data: newCh, error: null });

    const res = await POST(
      makeRequest({ channel_id: "UC1", channel_name: "Ch1", category: "prop_firm_official" })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.channel).toEqual(newCh);
  });

  it("returns 500 on DB error", async () => {
    mockDb();
    mockSingle.mockResolvedValue({ data: null, error: { message: "unique constraint" } });

    const res = await POST(
      makeRequest({ channel_id: "UC1", channel_name: "Ch1", category: "prop_firm_official" })
    );
    expect(res.status).toBe(500);
  });
});
