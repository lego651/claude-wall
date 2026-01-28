/**
 * Lightweight API security helpers: CORS + basic per-IP rate limiting.
 *
 * Note: This is best-effort only. For strong, global rate limiting you would
 * typically use an external store (Redis, etc.). This in-memory approach
 * still helps cut obvious abuse on a single lambda instance.
 */

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL || "https://claude-wall.vercel.app",
];

// Simple in-memory rate limit store: ip -> { count, resetAt }
const rateLimitStore = new Map();

export function getClientIp(request) {
  const xfwd = request.headers.get("x-forwarded-for");
  if (xfwd) {
    return xfwd.split(",")[0].trim();
  }
  // NextRequest.ip in middleware, but here we fall back to a placeholder
  return "unknown";
}

/**
 * Validate Origin and build CORS headers.
 *
 * - If Origin is present and not in the allowlist → ok = false
 * - If Origin is missing (server-to-server) → allowed, uses default origin
 */
export function validateOrigin(request) {
  const origin = request.headers.get("origin");
  const defaultOrigin = ALLOWED_ORIGINS[0];

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    // Explicitly disallow unknown web origins
    return {
      ok: false,
      headers: {
        "Access-Control-Allow-Origin": defaultOrigin,
        Vary: "Origin",
      },
    };
  }

  const allowedOrigin = origin || defaultOrigin;

  return {
    ok: true,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Origin",
    },
  };
}

/**
 * Best-effort, in-memory rate limiting.
 *
 * @param {Request} request
 * @param {object} options
 * @param {number} options.limit - Max requests per window
 * @param {number} options.windowMs - Window size in ms
 * @returns {{ limited: boolean, retryAfterMs: number }}
 */
export function isRateLimited(request, { limit = 120, windowMs = 60_000 } = {}) {
  const ip = getClientIp(request);
  const now = Date.now();
  const existing = rateLimitStore.get(ip);

  if (!existing || now > existing.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfterMs: windowMs };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { limited: true, retryAfterMs: existing.resetAt - now };
  }

  return { limited: false, retryAfterMs: existing.resetAt - now };
}

