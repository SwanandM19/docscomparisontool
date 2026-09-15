import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { translationPdfSchema } from "@/lib/api-utils/validation";
import { generateTranslationPdf } from "@/lib/translation/pdf";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  directionLabel,
  LANGUAGE_LABELS,
  directionSource,
  directionTarget,
} from "@/types/translation";

/**
 * Renders a translation (original + translated text) to a Devanagari-capable
 * PDF and streams it back. Takes the text directly rather than a saved id so
 * the user can download a translation the moment it finishes.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = translationPdfSchema.parse(await req.json());

  const pdfBuffer = await generateTranslationPdf({
    fileName: body.fileName,
    direction: body.direction,
    directionLabel: directionLabel(body.direction),
    sourceLabel: LANGUAGE_LABELS[directionSource(body.direction)],
    targetLabel: LANGUAGE_LABELS[directionTarget(body.direction)],
    sourceText: body.sourceText,
    translatedText: body.translatedText,
    confidence: body.confidence,
  });

  const safeName =
    body.fileName.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9._-]/g, "-") || "translation";

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}-${directionTarget(
        body.direction
      )}.pdf"`,
    },
  });
});
