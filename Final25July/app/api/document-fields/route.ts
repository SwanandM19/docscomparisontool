import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { documentFieldsRequestSchema } from "@/lib/api-utils/validation";
import { detectDocumentFields } from "@/lib/ai/document-fields";
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
 * Reads an uploaded document's layout and returns every fillable field it
 * finds, flagging which are currently blank. This is the detect half of the
 * Document Filler's flow — the fill half is /api/invoice-fill.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = documentFieldsRequestSchema.parse(await req.json());

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

  const result = await detectDocumentFields(file);

  return apiSuccess(result, 200);
});
