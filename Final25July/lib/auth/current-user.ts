import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import type { SessionUser } from "@/types/user";

/**
 * Reads and verifies the session cookie for the current request. Use this in
 * Route Handlers / Server Components — for Edge middleware, call
 * `verifySessionToken` directly instead (this wraps `next/headers`, which
 * middleware doesn't have access to).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}
