import { GET } from "./route";

jest.mock("@/lib/youtube/ingest");
import { runYouTubeIngest } from "@/lib/youtube/ingest";

const MOCK_RESULT = {
  date: "2024-01-02",
  candidatesFound: 15,
  windowHoursUsed: 24,
  picksInserted: 3,
  errors: [],
};

function makeRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  return new Request("http://localhost/api/cron/fetch-youtube-news", { headers });
}

beforeEach(() => {
  jest.clearAllMocks();
  (runYouTubeIngest as jest.Mock).mockResolvedValue(MOCK_RESULT);
  delete process.env.CRON_SECRET;
});

describe("GET /api/cron/fetch-youtube-news", () => {
  describe("without CRON_SECRET (no auth required)", () => {
    it("returns 200 with ingest result on success", async () => {
      const response = await GET(makeRequest());
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.date).toBe("2024-01-02");
      expect(body.picksInserted).toBe(3);
    });

    it("includes timestamp and duration in response", async () => {
      const response = await GET(makeRequest());
      const body = await response.json();
      expect(body.timestamp).toBeDefined();
      expect(typeof body.duration).toBe("number");
    });

    it("returns 500 on ingest failure", async () => {
      (runYouTubeIngest as jest.Mock).mockRejectedValue(new Error("API quota exceeded"));
      const response = await GET(makeRequest());
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("API quota exceeded");
    });

    it("handles non-Error throws", async () => {
      (runYouTubeIngest as jest.Mock).mockRejectedValue("string error");
      const response = await GET(makeRequest());
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe("string error");
    });
  });

  describe("with CRON_SECRET set", () => {
    beforeEach(() => {
      process.env.CRON_SECRET = "my-secret";
    });

    afterEach(() => {
      delete process.env.CRON_SECRET;
    });

    it("returns 401 without auth header", async () => {
      const response = await GET(makeRequest());
      expect(response.status).toBe(401);
    });

    it("returns 401 with wrong secret", async () => {
      const response = await GET(makeRequest("Bearer wrong-secret"));
      expect(response.status).toBe(401);
    });

    it("returns 200 with correct secret", async () => {
      const response = await GET(makeRequest("Bearer my-secret"));
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
    });
  });
});
