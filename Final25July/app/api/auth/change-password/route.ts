import { connectToDatabase } from "@/lib/db/mongodb";
import { UserModel } from "@/lib/models/User";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { changePasswordSchema } from "@/lib/api-utils/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = changePasswordSchema.parse(await req.json());

  await connectToDatabase();

  const user = await UserModel.findById(session.id);
  if (!user) throw ApiError.unauthorized("Your session is no longer valid. Please sign in again.");

  const currentMatches = await verifyPassword(body.currentPassword, user.passwordHash);
  if (!currentMatches) throw ApiError.badRequest("Current password is incorrect.");

  user.passwordHash = await hashPassword(body.newPassword);
  await user.save();

  return apiSuccess({ updated: true });
});
