import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/db/mongodb";
import { UserModel } from "@/lib/models/User";
import type { SessionUser } from "@/types/user";

/**
 * Reads and verifies the session cookie for the current request, then
 * re-checks the account's role against the database before trusting it for
 * authorization. The JWT's own `role` claim is only ever as fresh as the
 * user's last login (see session.ts) — if an admin is demoted mid-session,
 * their existing cookie would otherwise keep granting admin access (and
 * admin-only data would keep leaking into their "own activity" views) for
 * up to 7 days. Costs one indexed lookup by _id per authenticated request,
 * which is fine outside the Edge middleware hot path (see below).
 *
 * Use this in Route Handlers / Server Components — for Edge middleware, call
 * `verifySessionToken` directly instead (this wraps `next/headers`, which
 * middleware doesn't have access to, and Edge can't reach MongoDB anyway).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  await connectToDatabase();
  const user = await UserModel.findById(session.id, { role: 1 }).lean();
  if (!user) return null;

  return { ...session, role: user.role === "admin" ? "admin" : "user" };
}
