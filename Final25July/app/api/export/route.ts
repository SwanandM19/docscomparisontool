import { connectToDatabase } from "@/lib/db/mongodb";
import { ComparisonModel } from "@/lib/models/Comparison";
import { logAudit } from "@/lib/models/AuditLog";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { exportRequestSchema } from "@/lib/api-utils/validation";
import { generateComparisonPdf } from "@/lib/export/pdf";
import { getCurrentUser } from "@/lib/auth/current-user";

export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = exportRequestSchema.parse(await req.json());

  await connectToDatabase();

  const comparison = await ComparisonModel.findById(body.comparisonId);
  if (!comparison) {
    throw ApiError.notFound(`Comparison ${body.comparisonId} not found.`);
  }

  const pdfBuffer = await generateComparisonPdf(comparison);

  await logAudit({
    action: "Report Generated",
    documentName: `Comparison ${comparison._id.toString()}`,
    user: session.email,
    status: "completed",
    details: "PDF comparison report exported.",
    relatedComparisonId: comparison._id.toString(),
  });

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="comparison-${comparison._id.toString()}.pdf"`,
    },
  });
});
