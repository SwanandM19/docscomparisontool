import { connectToDatabase } from "@/lib/db/mongodb";
import { DocumentModel } from "@/lib/models/Document";
import { logAudit } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { extractRequestSchema } from "@/lib/api-utils/validation";
import { extractDocumentData } from "@/lib/ai/extraction";
import { getCurrentUser } from "@/lib/auth/current-user";

export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = extractRequestSchema.parse(await req.json());

  await connectToDatabase();

  const doc = await DocumentModel.findById(body.documentId);
  if (!doc) {
    throw ApiError.notFound(`Document ${body.documentId} not found.`);
  }

  doc.status = "extracting";
  await doc.save();

  try {
    const { data, confidence } = await extractDocumentData({
      fileUrl: doc.fileUrl,
      mimeType: doc.mimeType,
      fileType: doc.fileType,
      expectedKind: doc.kind,
    });

    doc.extractedData = data;
    doc.extractionConfidence = confidence;
    doc.status = "extracted";
    doc.extractionError = null;
    await doc.save();

    await logAudit({
      action: "AI Extraction Completed",
      documentName: doc.fileName,
      user: session.email,
      status: "completed",
      details: `Extracted ${data.lineItems.length} line item(s) with ${confidence}% confidence.`,
    });

    return apiSuccess({
      documentId: doc._id.toString(),
      status: doc.status,
      extractedData: doc.extractedData,
      extractionConfidence: doc.extractionConfidence,
    });
  } catch (err) {
    doc.status = "failed";
    doc.extractionError = err instanceof Error ? err.message : "Unknown extraction error";
    await doc.save();

    await logAudit({
      action: "AI Extraction Failed",
      documentName: doc.fileName,
      user: session.email,
      status: "warning",
      details: doc.extractionError,
    });

    throw err;
  }
});
