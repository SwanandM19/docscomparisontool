import { connectToDatabase } from "@/lib/db/mongodb";
import { UserModel } from "@/lib/models/User";
import { logAudit } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { loginRequestSchema } from "@/lib/api-utils/validation";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import { isDesignatedAdminEmail } from "@/lib/auth/admin-designation";
import type { SessionUser } from "@/types/user";

export const POST = withErrorHandling(async (req: Request) => {
  const body = loginRequestSchema.parse(await req.json());

  await connectToDatabase();

  const user = await UserModel.findOne({ email: body.email.toLowerCase() });
  // Deliberately identical error for "no such user" and "wrong password" —
  // distinguishing them lets an attacker enumerate registered emails.
  const invalidCredentials = () => ApiError.unauthorized("Invalid email or password.");

  if (!user) throw invalidCredentials();

  const passwordMatches = await verifyPassword(body.password, user.passwordHash);
  if (!passwordMatches) throw invalidCredentials();

  // Keep the admin role in sync with ADMIN_EMAIL on every login — this is
  // what makes "change the admin" a one-line env edit instead of a database
  // edit. Runs before the approval-gate check below so a freshly-designated
  // admin isn't blocked by their own pending status.
  if (isDesignatedAdminEmail(user.email) && user.role !== "admin") {
    user.role = "admin";
    user.approved = true;
    await user.save();
    await logAudit({
      action: "User Promoted to Admin",
      documentName: user.email,
      user: user.email,
      status: "completed",
      details: `${user.email} matches ADMIN_EMAIL and was promoted to admin on login.`,
    });
  }

  // [ADMIN-APPROVAL] Delete this block to retire the feature. Admins are
  // exempt as a safety net — there must always be at least one account that
  // can log in to approve everyone else.
  if (!user.approved && user.role !== "admin") {
    throw ApiError.forbidden("Your account is awaiting admin approval before you can sign in.");
  }
  // [ADMIN-APPROVAL] End of block.

  const sessionUser: SessionUser = {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
  };

  const token = await createSessionToken(sessionUser);
  const response = apiSuccess(sessionUser);
  response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return response;
});
