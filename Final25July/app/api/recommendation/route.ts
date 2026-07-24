import { connectToDatabase } from "@/lib/db/mongodb";
import { ComparisonModel } from "@/lib/models/Comparison";
import { logAudit } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { recommendationRequestSchema } from "@/lib/api-utils/validation";
import { generateRecommendation } from "@/lib/ai/recommendation";
import { getCurrentUser } from "@/lib/auth/current-user";

export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = recommendationRequestSchema.parse(await req.json());

  await connectToDatabase();

  const comparison = await ComparisonModel.findById(body.comparisonId);
  if (!comparison) {
    throw ApiError.notFound(`Comparison ${body.comparisonId} not found.`);
  }

  const recommendation = await generateRecommendation(comparison);
  comparison.aiRecommendation = recommendation;
  await comparison.save();

  await logAudit({
    action: "Approval Recommendation Generated",
    documentName: comparison.documentKinds.join(" + "),
    user: session.email,
    status: recommendation.decision === "Reject" ? "warning" : "completed",
    details: `AI recommended: ${recommendation.decision}`,
    relatedComparisonId: comparison._id.toString(),
  });

  return apiSuccess({ comparisonId: comparison._id.toString(), aiRecommendation: recommendation });
});
