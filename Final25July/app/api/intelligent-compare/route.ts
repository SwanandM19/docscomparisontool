import { connectToDatabase } from "@/lib/db/mongodb";
import { IntelligentComparisonModel } from "@/lib/models/IntelligentComparison";
import { logAudit } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { intelligentCompareRequestSchema } from "@/lib/api-utils/validation";
import { runIntelligentComparison } from "@/lib/ai/intelligent-comparison";
import { resolveFileType } from "@/lib/utils/file-type";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { IntelligentFileType, IntelligentSourceFile } from "@/types/intelligent";

const MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024;

/** Maps the procurement file-type helper onto the intelligent section's set. */
function toIntelligentFileType(mimeType: string, fileName: string): IntelligentFileType {
  if (mimeType === "text/plain" || fileName.toLowerCase().endsWith(".txt")) return "text";
  const resolved = resolveFileType(mimeType, fileName);
  return resolved as IntelligentFileType;
}

export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = intelligentCompareRequestSchema.parse(await req.json());

  for (const file of body.files) {
    if (file.fileSize > MAX_FILE_SIZE_BYTES) {
      throw ApiError.badRequest(
        `"${file.fileName}" exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit.`
      );
    }
  }

  await connectToDatabase();

  const files: IntelligentSourceFile[] = body.files.map((file) => ({
    fileUrl: file.fileUrl,
    fileName: file.fileName,
    fileSize: file.fileSize,
    mimeType: file.mimeType,
    fileType: toIntelligentFileType(file.mimeType, file.fileName),
  }));

  const { documentSummaries, comparison } = await runIntelligentComparison(files);

  const record = await IntelligentComparisonModel.create({
    files,
    documentSummaries,
    comparison,
    createdBy: session.email,
  });

  await logAudit({
    action: "Intelligent Comparison Completed",
    documentName: files.map((f) => f.fileName).join(" vs "),
    user: session.email,
    status:
      comparison.verdict.rating === "Divergent" || comparison.verdict.rating === "Weak Match"
        ? "warning"
        : "completed",
    details: `${comparison.documentsCompared} — ${comparison.verdict.rating}. ${comparison.alignedFindings.length} aligned finding(s).`,
  });

  return apiSuccess(
    {
      id: record._id.toString(),
      files,
      documentSummaries,
      comparison,
    },
    201
  );
});
