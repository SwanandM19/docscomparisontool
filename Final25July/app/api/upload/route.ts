import { connectToDatabase } from "@/lib/db/mongodb";
import { DocumentModel } from "@/lib/models/Document";
import { logAudit } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { uploadRequestSchema } from "@/lib/api-utils/validation";
import { resolveFileType } from "@/lib/utils/file-type";
import { getCurrentUser } from "@/lib/auth/current-user";

const ALLOWED_MIME_PREFIXES = ["application/pdf", "image/", "application/vnd", "application/msword", "text/csv"];
const MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024; // 16MB, matches UploadThing config

function validateFile(mimeType: string, fileSize: number) {
  const allowed = ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
  if (!allowed) {
    throw ApiError.badRequest(`Unsupported file type: ${mimeType}`);
  }
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw ApiError.badRequest(
      `File exceeds the maximum allowed size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`
    );
  }
}

export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = uploadRequestSchema.parse(await req.json());

  validateFile(body.mimeType, body.fileSize);

  await connectToDatabase();

  const fileType = resolveFileType(body.mimeType, body.fileName);

  const doc = await DocumentModel.create({
    kind: body.kind,
    fileUrl: body.fileUrl,
    fileName: body.fileName,
    fileSize: body.fileSize,
    mimeType: body.mimeType,
    fileType,
    status: "uploaded",
  });

  await logAudit({
    action: "Document Uploaded",
    documentName: body.fileName,
    user: session.email,
    status: "completed",
    details: `${body.kind} document uploaded (${(body.fileSize / 1024).toFixed(0)} KB)`,
  });

  return apiSuccess(
    {
      documentId: doc._id.toString(),
      kind: doc.kind,
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      fileType: doc.fileType,
      status: doc.status,
    },
    201
  );
});
