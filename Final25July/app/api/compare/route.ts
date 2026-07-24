import { connectToDatabase } from "@/lib/db/mongodb";
import { DocumentModel } from "@/lib/models/Document";
import { ComparisonModel } from "@/lib/models/Comparison";
import { ToleranceRuleModel, DEFAULT_TOLERANCE_RULES } from "@/lib/models/ToleranceRule";
import { logAudit } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { compareRequestSchema } from "@/lib/api-utils/validation";
import { runComparison, type ComparisonInputDoc } from "@/lib/comparison/engine";
import type { ToleranceRuleInput } from "@/types/comparison";
import { v4 as uuid } from "uuid";
import { getCurrentUser } from "@/lib/auth/current-user";

async function getEffectiveToleranceRules(
  overrides: ToleranceRuleInput[] | undefined
): Promise<ToleranceRuleInput[]> {
  let stored = await ToleranceRuleModel.find({});
  if (stored.length === 0) {
    stored = await ToleranceRuleModel.insertMany(DEFAULT_TOLERANCE_RULES);
  }

  const baseline: ToleranceRuleInput[] = stored.map((r) => ({
    id: r._id.toString(),
    field: r.field,
    type: r.type,
    value: r.value,
    unit: r.unit,
    enabled: r.enabled,
    category: r.category,
    description: r.description,
  }));

  if (!overrides || overrides.length === 0) {
    return baseline;
  }

  // Merge overrides on top of the stored baseline by field name (case
  // insensitive), so a partial override (e.g. just "Unit Price" from the
  // comparator's tolerance slider) doesn't wipe out unrelated rules like
  // "Document Date" or "Tax Amount".
  const merged = new Map(baseline.map((r) => [r.field.toLowerCase(), r]));
  for (const override of overrides) {
    merged.set(override.field.toLowerCase(), { ...override, id: override.id ?? uuid() });
  }
  return Array.from(merged.values());
}

export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = compareRequestSchema.parse(await req.json());

  await connectToDatabase();

  if (body.mode === "3-way" && body.documentIds.length !== 3) {
    throw ApiError.badRequest("3-way matching requires exactly 3 document IDs (PO, GRN, Invoice).");
  }
  if (body.mode !== "3-way" && body.documentIds.length !== 2) {
    throw ApiError.badRequest(`${body.mode} matching requires exactly 2 document IDs.`);
  }

  const documents = await DocumentModel.find({ _id: { $in: body.documentIds } });
  if (documents.length !== body.documentIds.length) {
    throw ApiError.notFound("One or more documents could not be found.");
  }

  // Preserve the order the client requested (Mongo $in doesn't guarantee order).
  const orderedDocs = body.documentIds.map((id) => documents.find((d) => d._id.toString() === id)!);

  for (const doc of orderedDocs) {
    if (doc.status !== "extracted" || !doc.extractedData) {
      throw ApiError.badRequest(
        `Document "${doc.fileName}" has not completed extraction yet (status: ${doc.status}). Run /api/extract first.`
      );
    }
  }

  const toleranceRules = await getEffectiveToleranceRules(body.toleranceRules);

  const engineInputs: ComparisonInputDoc[] = orderedDocs.map((doc) => ({
    documentId: doc._id.toString(),
    kind: doc.kind,
    data: doc.extractedData!,
    confidence: doc.extractionConfidence ?? 0,
  }));

  const result = runComparison(body.mode, engineInputs, toleranceRules);

  const comparison = await ComparisonModel.create({
    mode: body.mode,
    documentIds: orderedDocs.map((d) => d._id),
    documentKinds: orderedDocs.map((d) => d.kind),
    presetUsed: body.presetUsed,
    toleranceRules,
    fieldDiffs: result.fieldDiffs,
    lineItemDiffs: result.lineItemDiffs,
    missingItems: result.missingItems,
    extraItems: result.extraItems,
    score: result.score,
    financials: result.financials,
    aiSummary: null,
    aiRecommendation: null,
    chatHistory: [],
    createdBy: session.email,
  });

  await logAudit({
    action: "Comparison Completed",
    documentName: orderedDocs.map((d) => d.fileName).join(" vs "),
    user: session.email,
    status: result.score.status === "Failed" ? "warning" : "completed",
    details: `${result.fieldDiffs.filter((d) => !d.withinTolerance).length + result.lineItemDiffs.filter((d) => d.qtyVariance || d.priceVariance).length} discrepancy(ies) found. Match score ${result.score.matchScore}%.`,
    relatedComparisonId: comparison._id.toString(),
  });

  return apiSuccess(
    {
      comparisonId: comparison._id.toString(),
      mode: comparison.mode,
      score: comparison.score,
      financials: comparison.financials,
      fieldDiffs: comparison.fieldDiffs,
      lineItemDiffs: comparison.lineItemDiffs,
      missingItems: comparison.missingItems,
      extraItems: comparison.extraItems,
    },
    201
  );
});
