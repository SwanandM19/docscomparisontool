import { connectToDatabase } from "@/lib/db/mongodb";
import { UserModel } from "@/lib/models/User";
import { logAudit } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { signupRequestSchema } from "@/lib/api-utils/validation";
import { hashPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import type { SessionUser } from "@/types/user";

export const POST = withErrorHandling(async (req: Request) => {
  const body = signupRequestSchema.parse(await req.json());

  await connectToDatabase();

  const existing = await UserModel.findOne({ email: body.email.toLowerCase() });
  if (existing) {
    throw ApiError.conflict("An account with that email already exists.");
  }

  // The very first account to sign up becomes the workspace admin; everyone
  // after that gets the standard "user" role. No invite/promotion flow
  // exists beyond this bootstrap.
  const isFirstUser = (await UserModel.countDocuments({})) === 0;

  const passwordHash = await hashPassword(body.password);
  const user = await UserModel.create({
    email: body.email.toLowerCase(),
    passwordHash,
    name: body.name,
    role: isFirstUser ? "admin" : "user",
  });

  const sessionUser: SessionUser = {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
  };

  await logAudit({
    action: "Account Created",
    documentName: user.email,
    user: user.email,
    status: "completed",
    details: `New ${sessionUser.role} account registered.`,
  });

  const token = await createSessionToken(sessionUser);
  const response = apiSuccess(sessionUser, 201);
  response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return response;
});
