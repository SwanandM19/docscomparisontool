import { connectToDatabase } from "@/lib/db/mongodb";
import { AuditLogModel } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { requireAdmin } from "@/lib/auth/require-admin";

export const DELETE = withErrorHandling(
  async (_req: Request, context: { params: Promise<{ id: string }> }) => {
    await requireAdmin();
    const { id } = await context.params;

    await connectToDatabase();

    const deleted = await AuditLogModel.findByIdAndDelete(id);
    if (!deleted) {
      throw ApiError.notFound(`Audit entry ${id} not found.`);
    }

    return apiSuccess({ id });
  }
);
