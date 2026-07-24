import { connectToDatabase } from "@/lib/db/mongodb";
import { UserModel } from "@/lib/models/User";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { loginRequestSchema } from "@/lib/api-utils/validation";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
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
