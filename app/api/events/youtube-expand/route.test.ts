import { POST } from "./route";
import { NextResponse } from "next/server";

jest.mock("@/lib/supabase/service");
import { createServiceClient } from "@/lib/supabase/service";

const mockInsert = jest.fn();
const mockFrom = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockInsert.mockResolvedValue({ error: null });
  mockFrom.mockReturnValue({ insert: mockInsert });
  (createServiceClient as jest.Mock).mockReturnValue({ from: mockFrom });
});

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/events/youtube-expand", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/events/youtube-expand", () => {
  it("returns 400 when event_type is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/event_type/);
  });

  it("returns 400 when event_type is not a string", async () => {
    const res = await POST(makeRequest({ event_type: 42 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/api/events/youtube-expand", {
      method: "POST",
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("inserts event and returns success on valid input", async () => {
    const res = await POST(makeRequest({ event_type: "youtube_expand", metadata: { total: 10 } }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith("page_events");
    expect(mockInsert).toHaveBeenCalledWith({
      event_type: "youtube_expand",
      metadata: { total: 10 },
    });
  });

  it("passes null metadata when not provided", async () => {
    await POST(makeRequest({ event_type: "youtube_expand" }));
    expect(mockInsert).toHaveBeenCalledWith({
      event_type: "youtube_expand",
      metadata: null,
    });
  });

  it("returns 500 when Supabase insert fails", async () => {
    mockInsert.mockResolvedValue({ error: { message: "db error" } });
    const res = await POST(makeRequest({ event_type: "youtube_expand" }));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("db error");
  });
});
