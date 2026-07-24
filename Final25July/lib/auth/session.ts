import { SignJWT, jwtVerify } from "jose";
import type { SessionUser } from "@/types/user";

export const SESSION_COOKIE = "docintel_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is missing. Add it to .env.local.");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Signs a session JWT for the given user. Payload intentionally stays tiny
 * (id/email/name/role) — session reads never hit the database, so any
 * profile field beyond this requires re-authenticating to refresh.
 */
export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

/**
 * Verifies a session JWT and returns the encoded user, or null if the token
 * is missing, expired, or tampered with. Uses `jose`'s WebCrypto-based
 * verification so this is safe to call from Edge middleware, not just
 * Node.js API routes.
 */
export async function verifySessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sub !== "string" || typeof payload.email !== "string" || typeof payload.name !== "string") {
      return null;
    }
    const role = payload.role === "admin" ? "admin" : "user";
    return { id: payload.sub, email: payload.email, name: payload.name, role };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
