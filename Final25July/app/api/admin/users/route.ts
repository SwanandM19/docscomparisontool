// [ADMIN-APPROVAL] This entire file is part of the admin-approval feature.
// Delete it (and the sibling app/api/admin/users/[id]/route.ts) to retire it.
import { connectToDatabase } from "@/lib/db/mongodb";
import { UserModel } from "@/lib/models/User";
import { apiSuccess } from "@/lib/api-utils/response";
import { withErrorHandling } from "@/lib/api-utils/errors";
import { requireAdmin } from "@/lib/auth/require-admin";

export const GET = withErrorHandling(async () => {
  await requireAdmin();

  await connectToDatabase();

  const pending = await UserModel.find({ approved: false }).sort({ createdAt: 1 });

  return apiSuccess({
    pending: pending.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
    })),
  });
});
