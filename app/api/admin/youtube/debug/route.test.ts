import { GET, POST } from "./route";

jest.mock("@/lib/supabase/service");
import { createServiceClient } from "@/lib/supabase/service";

jest.mock("@/lib/youtube/ingest");
import { runYouTubeIngest } from "@/lib/youtube/ingest";

const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

function buildMock(data: unknown = [], error: unknown = null) {
  mockOrder.mockResolvedValue({ data, error });
  mockSelect.mockReturnValue({ eq: jest.fn().mockReturnValue({ order: mockOrder }) });
  mockFrom.mockReturnValue({ select: mockSelect });
  (createServiceClient as jest.Mock).mockReturnValue({ from: mockFrom });
}

beforeEach(() => {
  jest.clearAllMocks();
  buildMock();
});

describe("GET /api/admin/youtube/debug", () => {
  it("returns candidates and date", async () => {
    const candidates = [{ id: "1", rank: 1, title: "Test", score: 0.8 }];
    buildMock(candidates);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidates).toEqual(candidates);
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns empty array when no candidates", async () => {
    buildMock([]);
    const res = await GET();
    const body = await res.json();
    expect(body.candidates).toEqual([]);
  });

  it("returns 500 on DB error", async () => {
    buildMock(null, { message: "DB error" });
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("returns 500 on thrown error", async () => {
    (createServiceClient as jest.Mock).mockImplementation(() => { throw new Error("boom"); });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/admin/youtube/debug", () => {
  it("runs ingest and returns result", async () => {
    const mockResult = { date: "2024-01-02", candidatesFound: 10, windowHoursUsed: 24, picksInserted: 3, errors: [] };
    (runYouTubeIngest as jest.Mock).mockResolvedValue(mockResult);

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.picksInserted).toBe(3);
  });

  it("returns 500 on ingest failure", async () => {
    (runYouTubeIngest as jest.Mock).mockRejectedValue(new Error("quota exceeded"));
    const res = await POST();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("quota exceeded");
  });
});
