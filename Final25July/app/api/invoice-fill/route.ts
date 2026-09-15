import { logAudit } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { invoiceFillRequestSchema } from "@/lib/api-utils/validation";
import { fillDocumentFields } from "@/lib/ai/invoice-fill";
import { resolveFileType } from "@/lib/utils/file-type";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { PromptFile } from "@/lib/ai/file-parts";

const MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024;

function toPromptFileType(mimeType: string, fileName: string): PromptFile["fileType"] {
  const lower = fileName.toLowerCase();
  if (mimeType === "application/rtf" || mimeType === "text/rtf" || lower.endsWith(".rtf"))
    return "rtf";
  if (mimeType === "text/plain" || lower.endsWith(".txt")) return "text";
  return resolveFileType(mimeType, fileName) as PromptFile["fileType"];
}

/**
 * Takes an uploaded invoice / form / template plus the per-field values the
 * user typed in for its detected fields (see /api/document-fields) and
 * returns the document with those fields filled in. The file must already
 * be uploaded via UploadThing.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = invoiceFillRequestSchema.parse(await req.json());

  if (body.file.fileSize > MAX_FILE_SIZE_BYTES) {
    throw ApiError.badRequest(
      `"${body.file.fileName}" exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit.`
    );
  }

  const file: PromptFile = {
    fileUrl: body.file.fileUrl,
    fileName: body.file.fileName,
    mimeType: body.file.mimeType,
    fileType: toPromptFileType(body.file.mimeType, body.file.fileName),
  };

  const result = await fillDocumentFields(file, body.fields, body.notes);

  await logAudit({
    action: "Invoice Document Filled",
    documentName: body.file.fileName,
    user: session.email,
    status: result.unresolved.length > 0 ? "warning" : "completed",
    details: `${result.documentType}: ${result.fields.length} field(s) filled${
      result.unresolved.length ? `, ${result.unresolved.length} left blank` : ""
    }`,
  });

  return apiSuccess(result, 201);
});
