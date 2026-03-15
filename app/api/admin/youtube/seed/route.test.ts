import { POST } from "./route";

jest.mock("@/lib/supabase/service");
import { createServiceClient } from "@/lib/supabase/service";

const mockChUpsert = jest.fn();
const mockKwUpsert = jest.fn();
const mockFrom = jest.fn();

function buildMock() {
  mockChUpsert.mockResolvedValue({ error: null });
  mockKwUpsert.mockResolvedValue({ error: null });
  mockFrom.mockImplementation((table: string) => {
    if (table === "youtube_channels") return { upsert: mockChUpsert };
    if (table === "youtube_keywords") return { upsert: mockKwUpsert };
    return {};
  });
  (createServiceClient as jest.Mock).mockReturnValue({ from: mockFrom });
}

beforeEach(() => {
  jest.clearAllMocks();
  buildMock();
});

describe("POST /api/admin/youtube/seed", () => {
  it("returns 200 and upserts channels and keywords", async () => {
    const req = new Request("http://localhost/api/admin/youtube/seed", { method: "POST" });
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockChUpsert).toHaveBeenCalledTimes(1);
    expect(mockKwUpsert).toHaveBeenCalledTimes(1);
  });

  it("returns 500 on channels DB error", async () => {
    mockChUpsert.mockResolvedValue({ error: { message: "ch error" } });
    const res = await POST();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("ch error");
  });

  it("returns 500 on keywords DB error", async () => {
    mockKwUpsert.mockResolvedValue({ error: { message: "kw error" } });
    const res = await POST();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("kw error");
  });

  it("returns 500 on thrown error", async () => {
    (createServiceClient as jest.Mock).mockImplementation(() => { throw new Error("boom"); });
    const res = await POST();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("boom");
  });
});
