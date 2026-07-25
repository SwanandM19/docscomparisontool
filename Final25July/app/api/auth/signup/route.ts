import { connectToDatabase } from "@/lib/db/mongodb";
import { UserModel } from "@/lib/models/User";
import { logAudit } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { signupRequestSchema } from "@/lib/api-utils/validation";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import { isDesignatedAdminEmail } from "@/lib/auth/admin-designation";
import type { SessionUser } from "@/types/user";

export const POST = withErrorHandling(async (req: Request) => {
  const body = signupRequestSchema.parse(await req.json());

  await connectToDatabase();

  const existing = await UserModel.findOne({ email: body.email.toLowerCase() });
  if (existing) {
    throw ApiError.conflict("An account with that email already exists.");
  }

  // The very first account to sign up becomes the workspace admin; everyone
  // after that gets the standard "user" role — unless their email matches
  // ADMIN_EMAIL, in which case they're always admin regardless of order.
  const isFirstUser = (await UserModel.countDocuments({})) === 0;
  const isDesignatedAdmin = isDesignatedAdminEmail(body.email);
  const grantsAdmin = isFirstUser || isDesignatedAdmin;

  const passwordHash = await hashPassword(body.password);
  const user = await UserModel.create({
    email: body.email.toLowerCase(),
    passwordHash,
    name: body.name,
    role: grantsAdmin ? "admin" : "user",
    // [ADMIN-APPROVAL] The bootstrap admin (and the ADMIN_EMAIL-designated
    // admin) auto-approve; every other signup starts pending. Remove this
    // line (and the field default becomes moot) to retire the feature.
    approved: grantsAdmin,
  });

  await logAudit({
    action: "Account Created",
    documentName: user.email,
    user: user.email,
    status: "completed",
    details: `New ${user.role} account registered.`,
  });

  // [ADMIN-APPROVAL] Start of block — delete down to the matching end-marker
  // to retire the feature, then restore the plain "issue a session"
  // behavior below (uncomment it).
  if (!user.approved) {
    await logAudit({
      action: "Account Pending Approval",
      documentName: user.email,
      user: user.email,
      status: "pending",
      details: "New account is awaiting admin approval before it can sign in.",
    });
    return apiSuccess({ pendingApproval: true }, 201);
  }
  // [ADMIN-APPROVAL] End of block.

  const sessionUser: SessionUser = {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
  };

  const token = await createSessionToken(sessionUser);
  const response = apiSuccess(sessionUser, 201);
  response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return response;
});
