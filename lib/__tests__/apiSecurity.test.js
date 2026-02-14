/**
 * @jest-environment node
 */
import {
  getClientIp,
  validateOrigin,
  isRateLimited,
} from "@/lib/apiSecurity";

function requestWithHeaders(headers) {
  return new Request("https://example.com/api", { headers });
}

describe("lib/apiSecurity", () => {
  describe("getClientIp", () => {
    it("extracts IP from x-forwarded-for", () => {
      const req = requestWithHeaders({ "x-forwarded-for": "203.0.113.42" });
      expect(getClientIp(req)).toBe("203.0.113.42");
    });

    it("handles multiple IPs (takes first)", () => {
      const req = requestWithHeaders({
        "x-forwarded-for": "203.0.113.42, 70.41.3.18, 150.172.238.178",
      });
      expect(getClientIp(req)).toBe("203.0.113.42");
    });

    it("trims whitespace from first IP", () => {
      const req = requestWithHeaders({ "x-forwarded-for": "  203.0.113.42  " });
      expect(getClientIp(req)).toBe("203.0.113.42");
    });

    it("fallback to unknown if header missing", () => {
      const req = requestWithHeaders({});
      expect(getClientIp(req)).toBe("unknown");
    });
  });

  describe("validateOrigin", () => {
    it("allows same-origin requests (origin matches request URL)", () => {
      const req = new Request("https://other.example.com/api", {
        headers: { Origin: "https://other.example.com" },
      });
      const result = validateOrigin(req);
      expect(result.ok).toBe(true);
      expect(result.headers["Access-Control-Allow-Origin"]).toBe(
        "https://other.example.com"
      );
    });

    it("allows missing origin header (server-to-server)", () => {
      const req = new Request("https://example.com/api");
      const result = validateOrigin(req);
      expect(result.ok).toBe(true);
      expect(result.headers["Access-Control-Allow-Origin"]).toBe(
        "https://example.com"
      );
    });

    it("allows whitelisted origins", () => {
      const req = new Request("https://example.com/api", {
        headers: { Origin: "http://localhost:3000" },
      });
      const result = validateOrigin(req);
      expect(result.ok).toBe(true);
      expect(result.headers["Access-Control-Allow-Origin"]).toBe(
        "http://localhost:3000"
      );
    });

    it("blocks unknown origins", () => {
      const req = new Request("https://claude-wall.vercel.app/api", {
        headers: { Origin: "https://evil.com" },
      });
      const result = validateOrigin(req);
      expect(result.ok).toBe(false);
      expect(result.headers["Access-Control-Allow-Origin"]).toBeDefined();
      expect(result.headers.Vary).toBe("Origin");
    });

    it("returns correct CORS headers when allowed", () => {
      const req = new Request("http://localhost:3000/api", {
        headers: { Origin: "http://localhost:3000" },
      });
      const result = validateOrigin(req);
      expect(result.ok).toBe(true);
      expect(result.headers["Access-Control-Allow-Origin"]).toBe(
        "http://localhost:3000"
      );
      expect(result.headers["Access-Control-Allow-Methods"]).toBe(
        "GET, OPTIONS"
      );
      expect(result.headers["Access-Control-Allow-Headers"]).toBe(
        "Content-Type"
      );
      expect(result.headers.Vary).toBe("Origin");
    });

    it("returns correct CORS headers when blocked", () => {
      const req = new Request("https://example.com/api", {
        headers: { Origin: "https://evil.com" },
      });
      const result = validateOrigin(req);
      expect(result.ok).toBe(false);
      expect(result.headers["Access-Control-Allow-Origin"]).toBeDefined();
      expect(result.headers.Vary).toBe("Origin");
    });

    it("uses defaultOrigin when request URL is invalid (no origin)", () => {
      const req = {
        url: "not-a-valid-url",
        headers: { get() { return null; } },
      };
      const result = validateOrigin(req);
      expect(result.ok).toBe(true);
      expect(result.headers["Access-Control-Allow-Origin"]).toBe(
        process.env.NEXT_PUBLIC_SITE_URL || "https://claude-wall.vercel.app"
      );
    });
  });

  describe("isRateLimited", () => {
    const uniqueIp = () => `192.168.1.${Math.floor(Math.random() * 256)}`;

    it("allows first request from IP", () => {
      const req = requestWithHeaders({ "x-forwarded-for": uniqueIp() });
      const result = isRateLimited(req, { limit: 60, windowMs: 60_000 });
      expect(result.limited).toBe(false);
      expect(typeof result.retryAfterMs).toBe("number");
    });

    it("uses default limit and windowMs when options omitted", () => {
      const req = requestWithHeaders({ "x-forwarded-for": uniqueIp() });
      const result = isRateLimited(req);
      expect(result.limited).toBe(false);
      expect(result.retryAfterMs).toBe(60_000);
    });

    it("rate limits after threshold (60/min)", () => {
      const ip = uniqueIp();
      const req = () =>
        requestWithHeaders({ "x-forwarded-for": ip });
      const limit = 3;
      const windowMs = 60_000;
      isRateLimited(req(), { limit, windowMs });
      isRateLimited(req(), { limit, windowMs });
      isRateLimited(req(), { limit, windowMs });
      const fourth = isRateLimited(req(), { limit, windowMs });
      expect(fourth.limited).toBe(true);
      expect(fourth.retryAfterMs).toBeGreaterThan(0);
    });

    it("resets after window expires", async () => {
      const ip = uniqueIp();
      const req = () =>
        requestWithHeaders({ "x-forwarded-for": ip });
      const windowMs = 20;
      isRateLimited(req(), { limit: 1, windowMs });
      // Wait well past the window so Date.now() is clearly > resetAt (avoids CI/timer flakiness)
      await new Promise((r) => setTimeout(r, 80));
      const afterWindow = isRateLimited(req(), { limit: 1, windowMs });
      expect(afterWindow.limited).toBe(false);
    }, 10_000);

    it("handles missing IP gracefully (unknown bucket)", () => {
      const req = requestWithHeaders({});
      const result = isRateLimited(req, { limit: 60, windowMs: 60_000 });
      expect(result.limited).toBe(false);
      expect(result.retryAfterMs).toBe(60_000);
    });

    it("returns correct retry-after time when not limited", () => {
      const ip = uniqueIp();
      const req = requestWithHeaders({ "x-forwarded-for": ip });
      const windowMs = 60_000;
      const result = isRateLimited(req, { limit: 120, windowMs });
      expect(result.limited).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(windowMs);
    });

    it("returns correct retry-after time when limited", () => {
      const ip = uniqueIp();
      const req = () =>
        requestWithHeaders({ "x-forwarded-for": ip });
      const windowMs = 60_000;
      isRateLimited(req(), { limit: 1, windowMs });
      const second = isRateLimited(req(), { limit: 1, windowMs });
      expect(second.limited).toBe(true);
      expect(second.retryAfterMs).toBeGreaterThan(0);
      expect(second.retryAfterMs).toBeLessThanOrEqual(windowMs);
    });
  });
});
