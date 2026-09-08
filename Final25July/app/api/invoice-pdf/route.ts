import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { invoicePdfSchema } from "@/lib/api-utils/validation";
import { generateInvoicePdf } from "@/lib/invoice/pdf";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Renders invoice data to a PDF and streams it back.
 *
 * Takes the invoice *data* rather than a saved id on purpose: the user can
 * download or share an invoice they haven't saved yet, and a saved invoice
 * is just the same data sent from the client's loaded copy. Nothing is
 * written to the database here.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = invoicePdfSchema.parse(await req.json());

  const pdfBuffer = await generateInvoicePdf(body.data);

  // Strip characters that aren't safe in a Content-Disposition filename.
  const safeNumber = (body.data.invoiceNumber || "invoice").replace(/[^A-Za-z0-9._-]/g, "-");

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${safeNumber}.pdf"`,
    },
  });
});
