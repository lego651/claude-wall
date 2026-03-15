import { PATCH } from "./route";

jest.mock("@/lib/supabase/service");
import { createServiceClient } from "@/lib/supabase/service";

const mockEq = jest.fn();
const mockUpdate = jest.fn();
const mockFrom = jest.fn();

function buildMock() {
  mockEq.mockResolvedValue({ error: null });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockFrom.mockReturnValue({ update: mockUpdate });
  (createServiceClient as jest.Mock).mockReturnValue({ from: mockFrom });
}

beforeEach(() => {
  jest.clearAllMocks();
  buildMock();
});

function makeRequest(body: unknown, id = "test-uuid") {
  return {
    req: new Request(`http://localhost/api/admin/youtube/keywords/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    params: Promise.resolve({ id }),
  };
}

describe("PATCH /api/admin/youtube/keywords/[id]", () => {
  it("returns 400 if active is not boolean", async () => {
    const { req, params } = makeRequest({ active: 1 });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(400);
  });

  it("returns 200 on success", async () => {
    const { req, params } = makeRequest({ active: false });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("returns 500 on DB error", async () => {
    mockEq.mockResolvedValue({ error: { message: "not found" } });
    const { req, params } = makeRequest({ active: true });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(500);
  });

  it("returns 500 on thrown error", async () => {
    (createServiceClient as jest.Mock).mockImplementation(() => { throw new Error("boom"); });
    const { req, params } = makeRequest({ active: true });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(500);
  });
});
