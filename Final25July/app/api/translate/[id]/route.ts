import { connectToDatabase } from "@/lib/db/mongodb";
import { TranslationModel } from "@/lib/models/Translation";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { getCurrentUser } from "@/lib/auth/current-user";

export const GET = withErrorHandling(
  async (_req: Request, context: { params: Promise<{ id: string }> }) => {
    const session = await getCurrentUser();
    if (!session) throw ApiError.unauthorized();

    const { id } = await context.params;

    await connectToDatabase();

    const record = await TranslationModel.findById(id);
    if (!record) {
      throw ApiError.notFound(`Translation ${id} not found.`);
    }

    // Regular users can only open translations they created; admins can open any.
    if (session.role !== "admin" && record.createdBy !== session.email) {
      throw ApiError.notFound(`Translation ${id} not found.`);
    }

    return apiSuccess({
      id: record._id.toString(),
      file: record.file,
      direction: record.direction,
      result: record.result,
    });
  }
);
