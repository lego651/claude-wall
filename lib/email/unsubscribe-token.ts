/**
 * TICKET-015: Signed token for digest unsubscribe link.
 * Payload: { userId, exp } with HMAC-SHA256 signature.
 */

import crypto from "crypto";

const ALG = "sha256";
const SEP = ".";

function getSecret(): string {
  const secret = process.env.DIGEST_UNSUBSCRIBE_SECRET || process.env.RESEND_API_KEY;
  if (!secret) throw new Error("DIGEST_UNSUBSCRIBE_SECRET or RESEND_API_KEY is required for unsubscribe tokens");
  return secret;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Buffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (3 - (str.length % 4)) % 4);
  return Buffer.from(base64, "base64");
}

export function createUnsubscribeToken(userId: string, expSeconds = 60 * 60 * 24 * 365): string {
  const exp = Math.floor(Date.now() / 1000) + expSeconds;
  const payload = JSON.stringify({ userId, exp });
  const payloadB64 = base64UrlEncode(Buffer.from(payload, "utf8"));
  const secret = getSecret();
  const sig = crypto.createHmac(ALG, secret).update(payloadB64).digest();
  const sigB64 = base64UrlEncode(sig);
  return `${payloadB64}${SEP}${sigB64}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  try {
    const [payloadB64, sigB64] = token.split(SEP);
    if (!payloadB64 || !sigB64) return null;
    const secret = getSecret();
    const expectedSig = crypto.createHmac(ALG, secret).update(payloadB64).digest();
    const sig = base64UrlDecode(sigB64);
    if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(sig, expectedSig)) return null;
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8"));
    if (typeof payload.userId !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.userId;
  } catch {
    return null;
  }
}
