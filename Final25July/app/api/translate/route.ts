import { connectToDatabase } from "@/lib/db/mongodb";
import { TranslationModel } from "@/lib/models/Translation";
import { logAudit } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { translateRequestSchema } from "@/lib/api-utils/validation";
import { translateDocument } from "@/lib/ai/translation";
import { resolveFileType } from "@/lib/utils/file-type";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  directionLabel,
  type TranslationFileType,
  type TranslationSourceFile,
} from "@/types/translation";

const MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024;

/** Maps the procurement file-type helper onto the translation section's set. */
function toTranslationFileType(mimeType: string, fileName: string): TranslationFileType {
  const lower = fileName.toLowerCase();
  if (mimeType === "application/rtf" || mimeType === "text/rtf" || lower.endsWith(".rtf"))
    return "rtf";
  if (mimeType === "text/plain" || lower.endsWith(".txt")) return "text";
  return resolveFileType(mimeType, fileName) as TranslationFileType;
}

/**
 * Translates a single uploaded document between English and Marathi and
 * stores the result. The file must already be uploaded via UploadThing —
 * this route only receives its URL and metadata.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = translateRequestSchema.parse(await req.json());

  if (body.file.fileSize > MAX_FILE_SIZE_BYTES) {
    throw ApiError.badRequest(
      `"${body.file.fileName}" exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit.`
    );
  }

  await connectToDatabase();

  const file: TranslationSourceFile = {
    fileUrl: body.file.fileUrl,
    fileName: body.file.fileName,
    fileSize: body.file.fileSize,
    mimeType: body.file.mimeType,
    fileType: toTranslationFileType(body.file.mimeType, body.file.fileName),
  };

  const result = await translateDocument(file, body.direction);

  // The translation itself has succeeded by this point — never let a
  // persistence or audit-log hiccup throw away the result the user is
  // waiting for. Save best-effort and still return the translation.
  let recordId: string | null = null;
  try {
    const record = await TranslationModel.create({
      file,
      direction: body.direction,
      result,
      createdBy: session.email,
    });
    recordId = record._id.toString();

    await logAudit({
      action: "Document Translated",
      documentName: file.fileName,
      user: session.email,
      status: result.directionMismatch || result.truncated ? "warning" : "completed",
      details: `${directionLabel(body.direction)} · confidence ${Math.round(
        result.confidence * 100
      )}%${result.directionMismatch ? ` · detected ${result.detectedLanguage}` : ""}${
        result.truncated ? " · source truncated" : ""
      }`,
      relatedTranslationId: recordId,
    });
  } catch (err) {
    console.error("[api/translate] failed to persist translation:", err);
  }

  return apiSuccess(
    {
      id: recordId,
      file,
      direction: body.direction,
      result,
    },
    201
  );
});

/** Returns the signed-in user's most recent translations. */
export const GET = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const limit = Math.min(
    Number(new URL(req.url).searchParams.get("limit") ?? 10) || 10,
    50
  );

  await connectToDatabase();

  const records = await TranslationModel.find({ createdBy: session.email })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return apiSuccess({
    translations: records.map((r) => ({
      _id: String(r._id),
      file: r.file,
      direction: r.direction,
      result: r.result,
      createdBy: r.createdBy,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});
