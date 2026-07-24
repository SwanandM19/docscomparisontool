import { connectToDatabase } from "@/lib/db/mongodb";
import { AuditLogModel } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { withErrorHandling } from "@/lib/api-utils/errors";
import { requireAdmin } from "@/lib/auth/require-admin";

// Clears the entire audit log. Admin-only, destructive, and intentionally
// irreversible — there is no soft-delete/archive for audit rows.
export const DELETE = withErrorHandling(async () => {
  await requireAdmin();

  await connectToDatabase();

  const result = await AuditLogModel.deleteMany({});

  return apiSuccess({ deletedCount: result.deletedCount ?? 0 });
});
