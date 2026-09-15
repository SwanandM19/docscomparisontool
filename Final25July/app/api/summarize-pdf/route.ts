import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { summaryPdfSchema } from "@/lib/api-utils/validation";
import { generateSummaryPdf } from "@/lib/summary/pdf";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { DocumentSummary } from "@/types/summary";

/**
 * Renders one or more document summaries to a Devanagari-capable PDF and
 * streams it back. Takes the summary data directly so a summary can be
 * downloaded the moment it is generated.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = summaryPdfSchema.parse(await req.json());

  const pdfBuffer = await generateSummaryPdf(body.documents as DocumentSummary[]);

  const first = body.documents[0];
  const safeName =
    (body.documents.length === 1 ? first.fileName.replace(/\.[^.]+$/, "") : "document-summaries")
      .replace(/[^A-Za-z0-9._-]/g, "-") || "summary";

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}-summary.pdf"`,
    },
  });
});
