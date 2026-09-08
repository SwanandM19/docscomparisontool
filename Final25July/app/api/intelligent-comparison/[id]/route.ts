import { connectToDatabase } from "@/lib/db/mongodb";
import { IntelligentComparisonModel } from "@/lib/models/IntelligentComparison";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { getCurrentUser } from "@/lib/auth/current-user";

export const GET = withErrorHandling(
  async (_req: Request, context: { params: Promise<{ id: string }> }) => {
    const session = await getCurrentUser();
    if (!session) throw ApiError.unauthorized();

    const { id } = await context.params;

    await connectToDatabase();

    const record = await IntelligentComparisonModel.findById(id);
    if (!record) {
      throw ApiError.notFound(`Intelligent comparison ${id} not found.`);
    }

    // Regular users can only open their own; admins can open any.
    if (session.role !== "admin" && record.createdBy !== session.email) {
      throw ApiError.notFound(`Intelligent comparison ${id} not found.`);
    }

    return apiSuccess({
      _id: record._id.toString(),
      files: record.files,
      documentSummaries: record.documentSummaries,
      comparison: record.comparison,
      createdBy: record.createdBy,
      createdAt: record.createdAt.toISOString(),
    });
  }
);
