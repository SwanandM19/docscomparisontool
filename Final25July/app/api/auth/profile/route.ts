import { connectToDatabase } from "@/lib/db/mongodb";
import { UserModel } from "@/lib/models/User";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { updateProfileSchema } from "@/lib/api-utils/validation";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { UserRecord } from "@/types/user";

export const PATCH = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = updateProfileSchema.parse(await req.json());

  await connectToDatabase();

  const user = await UserModel.findById(session.id);
  if (!user) throw ApiError.unauthorized("Your session is no longer valid. Please sign in again.");

  if (body.name !== undefined) user.name = body.name;
  if (body.phone !== undefined) user.phone = body.phone;
  if (body.organization !== undefined) user.organization = body.organization;
  if (body.department !== undefined) user.department = body.department;
  await user.save();

  const record: UserRecord = {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    department: user.department,
    organization: user.organization,
    phone: user.phone,
    createdAt: user.createdAt.toISOString(),
  };

  return apiSuccess(record);
});
