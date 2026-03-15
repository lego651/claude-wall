import { GET, POST } from "./route";

jest.mock("@/lib/supabase/service");
import { createServiceClient } from "@/lib/supabase/service";

const mockSingle = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockOrder = jest.fn();
const mockFrom = jest.fn();

function buildMock() {
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockSelect.mockReturnValue({ order: mockOrder });
  mockInsert.mockReturnValue({ select: () => ({ single: mockSingle }) });
  mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert });
  (createServiceClient as jest.Mock).mockReturnValue({ from: mockFrom });
}

beforeEach(() => {
  jest.clearAllMocks();
  buildMock();
});

describe("GET /api/admin/youtube/keywords", () => {
  it("returns keywords list", async () => {
    const keywords = [{ id: "1", keyword: "prop firm", active: true }];
    mockOrder.mockResolvedValue({ data: keywords, error: null });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.keywords).toEqual(keywords);
  });

  it("returns 500 on DB error", async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: "DB error" } });
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("returns 500 on thrown error", async () => {
    (createServiceClient as jest.Mock).mockImplementation(() => { throw new Error("boom"); });
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/admin/youtube/keywords", () => {
  function makeRequest(body: unknown) {
    return new Request("http://localhost/api/admin/youtube/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 400 if keyword missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 if keyword is not string", async () => {
    const res = await POST(makeRequest({ keyword: 123 }));
    expect(res.status).toBe(400);
  });

  it("returns 201 on success", async () => {
    const newKw = { id: "1", keyword: "prop firm" };
    mockSingle.mockResolvedValue({ data: newKw, error: null });

    const res = await POST(makeRequest({ keyword: "prop firm" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.keyword).toEqual(newKw);
  });

  it("returns 500 on DB error", async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: "unique" } });
    const res = await POST(makeRequest({ keyword: "prop firm" }));
    expect(res.status).toBe(500);
  });
});
