import { connectToDatabase } from "@/lib/db/mongodb";
import { ComparisonModel } from "@/lib/models/Comparison";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { summaryRequestSchema } from "@/lib/api-utils/validation";
import { generateExecutiveSummary } from "@/lib/ai/summary";
import { getCurrentUser } from "@/lib/auth/current-user";

export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = summaryRequestSchema.parse(await req.json());

  await connectToDatabase();

  const comparison = await ComparisonModel.findById(body.comparisonId);
  if (!comparison) {
    throw ApiError.notFound(`Comparison ${body.comparisonId} not found.`);
  }

  const summary = await generateExecutiveSummary(comparison);
  comparison.aiSummary = summary;
  await comparison.save();

  return apiSuccess({ comparisonId: comparison._id.toString(), aiSummary: summary });
});
