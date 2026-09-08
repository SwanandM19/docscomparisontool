import { connectToDatabase } from "@/lib/db/mongodb";
import { DocumentModel } from "@/lib/models/Document";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { generateDocumentSummary } from "@/lib/ai/document-summary";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Generates (and caches) a standalone plain-language summary of a single
 * extracted document. Idempotent: returns the stored summary on repeat calls
 * unless `?refresh=1` is passed.
 */
export const POST = withErrorHandling(
  async (req: Request, context: { params: Promise<{ id: string }> }) => {
    const session = await getCurrentUser();
    if (!session) throw ApiError.unauthorized();

    const { id } = await context.params;
    const refresh = new URL(req.url).searchParams.get("refresh") === "1";

    await connectToDatabase();

    const doc = await DocumentModel.findById(id);
    if (!doc) {
      throw ApiError.notFound(`Document ${id} not found.`);
    }
    if (doc.status !== "extracted" || !doc.extractedData) {
      throw ApiError.badRequest(
        `Document "${doc.fileName}" has not completed extraction yet (status: ${doc.status}).`
      );
    }

    if (doc.aiSummary && !refresh) {
      return apiSuccess({ documentId: doc._id.toString(), aiSummary: doc.aiSummary });
    }

    const summary = await generateDocumentSummary(doc);
    doc.aiSummary = summary;
    await doc.save();

    return apiSuccess({ documentId: doc._id.toString(), aiSummary: summary });
  }
);
