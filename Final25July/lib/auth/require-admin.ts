import { ApiError } from "@/lib/api-utils/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { SessionUser } from "@/types/user";

/**
 * Returns the current session only if it belongs to an admin. Throws 401 if
 * not signed in, 403 if signed in but not an admin. Use in Route Handlers
 * that expose privileged (destructive/admin-only) operations.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();
  if (session.role !== "admin") {
    throw ApiError.forbidden("This action requires an administrator account.");
  }
  return session;
}
