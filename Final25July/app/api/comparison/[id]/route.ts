import { connectToDatabase } from "@/lib/db/mongodb";
import { ComparisonModel } from "@/lib/models/Comparison";
import { DocumentModel } from "@/lib/models/Document";
import { logAudit } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireAdmin } from "@/lib/auth/require-admin";

export const GET = withErrorHandling(
  async (_req: Request, context: { params: Promise<{ id: string }> }) => {
    const session = await getCurrentUser();
    if (!session) throw ApiError.unauthorized();

    const { id } = await context.params;

    await connectToDatabase();

    const comparison = await ComparisonModel.findById(id);
    if (!comparison) {
      throw ApiError.notFound(`Comparison ${id} not found.`);
    }

    // Regular users can only open comparisons they created; admins can open any.
    if (session.role !== "admin" && comparison.createdBy !== session.email) {
      throw ApiError.notFound(`Comparison ${id} not found.`);
    }

    const documents = await DocumentModel.find({ _id: { $in: comparison.documentIds } });

    return apiSuccess({
      _id: comparison._id.toString(),
      mode: comparison.mode,
      documentIds: comparison.documentIds.map((d) => d.toString()),
      documentKinds: comparison.documentKinds,
      documents: documents.map((d) => ({
        _id: d._id.toString(),
        kind: d.kind,
        fileName: d.fileName,
        fileUrl: d.fileUrl,
        extractedData: d.extractedData,
        extractionConfidence: d.extractionConfidence,
      })),
      presetUsed: comparison.presetUsed,
      toleranceRules: comparison.toleranceRules,
      fieldDiffs: comparison.fieldDiffs,
      lineItemDiffs: comparison.lineItemDiffs,
      missingItems: comparison.missingItems,
      extraItems: comparison.extraItems,
      score: comparison.score,
      financials: comparison.financials,
      aiSummary: comparison.aiSummary,
      aiRecommendation: comparison.aiRecommendation,
      chatHistory: comparison.chatHistory,
      createdAt: comparison.createdAt.toISOString(),
      createdBy: comparison.createdBy,
    });
  }
);

// Admin-only. Deletes a comparison and the Document records it referenced.
// The deletion itself is written to the audit log, so removing a comparison
// still leaves a trace of who removed it and when.
export const DELETE = withErrorHandling(
  async (_req: Request, context: { params: Promise<{ id: string }> }) => {
    const admin = await requireAdmin();
    const { id } = await context.params;

    await connectToDatabase();

    const comparison = await ComparisonModel.findById(id);
    if (!comparison) {
      throw ApiError.notFound(`Comparison ${id} not found.`);
    }

    const documentIds = comparison.documentIds.map((d) => d.toString());
    const label = comparison.documentKinds.join(" + ") || "comparison";

    await DocumentModel.deleteMany({ _id: { $in: comparison.documentIds } });
    await comparison.deleteOne();

    await logAudit({
      action: "Comparison Deleted",
      documentName: label,
      user: admin.email,
      status: "warning",
      details: `Comparison ${id} and ${documentIds.length} associated document(s) permanently deleted by admin.`,
    });

    return apiSuccess({ id, deletedDocuments: documentIds.length });
  }
);
