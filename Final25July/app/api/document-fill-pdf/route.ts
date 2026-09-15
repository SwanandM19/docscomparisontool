import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { documentFillPdfSchema } from "@/lib/api-utils/validation";
import { generateFilledDocumentPdf } from "@/lib/invoice/filled-document-pdf";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Renders a Document Filler result to a PDF and streams it back. Takes the
 * completed text directly rather than a saved id — nothing from this flow is
 * persisted server-side.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = documentFillPdfSchema.parse(await req.json());

  const pdfBuffer = await generateFilledDocumentPdf(body);

  const safeName = body.documentType.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 80) || "document";

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}.pdf"`,
    },
  });
});
