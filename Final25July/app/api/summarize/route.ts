import { logAudit } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { summarizeRequestSchema } from "@/lib/api-utils/validation";
import { summarizeFiles } from "@/lib/ai/file-summary";
import { resolveFileType } from "@/lib/utils/file-type";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { SummaryFileType, SummarySourceFile } from "@/types/summary";

const MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024;

function toSummaryFileType(mimeType: string, fileName: string): SummaryFileType {
  const lower = fileName.toLowerCase();
  if (mimeType === "application/rtf" || mimeType === "text/rtf" || lower.endsWith(".rtf"))
    return "rtf";
  if (mimeType === "text/plain" || lower.endsWith(".txt")) return "text";
  return resolveFileType(mimeType, fileName) as SummaryFileType;
}

/**
 * Produces a detailed structured summary for each uploaded document. At least
 * one file is required; the documents can be of any type. Files must already
 * be uploaded via UploadThing — this route only receives their URLs.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = summarizeRequestSchema.parse(await req.json());

  for (const file of body.files) {
    if (file.fileSize > MAX_FILE_SIZE_BYTES) {
      throw ApiError.badRequest(
        `"${file.fileName}" exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit.`
      );
    }
  }

  const files: SummarySourceFile[] = body.files.map((file) => ({
    fileUrl: file.fileUrl,
    fileName: file.fileName,
    fileSize: file.fileSize,
    mimeType: file.mimeType,
    fileType: toSummaryFileType(file.mimeType, file.fileName),
  }));

  const documents = await summarizeFiles(files);

  await logAudit({
    action: "Document Summary Generated",
    documentName: files.map((f) => f.fileName).join(", "),
    user: session.email,
    status: "completed",
    details: `${documents.length} document(s) summarized: ${documents
      .map((d) => d.documentType)
      .join(", ")}`,
  });

  return apiSuccess({ documents }, 201);
});
