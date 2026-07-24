import { connectToDatabase } from "@/lib/db/mongodb";
import { AuditLogModel } from "@/lib/models/AuditLog";
import { ComparisonModel } from "@/lib/models/Comparison";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { historyQuerySchema } from "@/lib/api-utils/validation";
import { getCurrentUser } from "@/lib/auth/current-user";

export const GET = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const { searchParams } = new URL(req.url);
  const query = historyQuerySchema.parse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
    status: searchParams.get("status") ?? undefined,
  });

  await connectToDatabase();

  // Regular users only ever see their own activity; admins see everything.
  // This is the single chokepoint Dashboard Overview, Vendor Analytics, and
  // History & Audits all read through, so scoping it here covers all three.
  const isAdmin = session.role === "admin";
  const auditFilter = isAdmin ? {} : { user: session.email };
  const comparisonFilter: Record<string, unknown> = isAdmin ? {} : { createdBy: session.email };
  if (query.status) comparisonFilter["score.status"] = query.status;

  const skip = (query.page - 1) * query.limit;

  const [auditEntries, totalAudits] = await Promise.all([
    AuditLogModel.find(auditFilter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    AuditLogModel.countDocuments(auditFilter),
  ]);

  const comparisons = await ComparisonModel.find(comparisonFilter).sort({ createdAt: -1 }).limit(200);

  // ── Vendor analytics aggregation, derived from comparison history ──
  // Groups by vendor name (pulled from the primary document's extracted
  // data via documentKinds[0]'s field diffs) — since we don't have a
  // separate Vendor collection, we approximate using fieldDiffs' "Vendor
  // Name" docAValue captured at comparison time.
  const vendorMap = new Map<
    string,
    { totalDocs: number; discrepancies: number; matchScores: number[] }
  >();

  for (const c of comparisons) {
    const vendorDiff = c.fieldDiffs.find((f) => f.fieldName === "Vendor Name");
    const vendorName = (vendorDiff?.docAValue as string) || (vendorDiff?.docBValue as string) || "Unknown Vendor";

    const entry = vendorMap.get(vendorName) ?? { totalDocs: 0, discrepancies: 0, matchScores: [] };
    entry.totalDocs += c.documentIds.length;
    entry.discrepancies +=
      c.fieldDiffs.filter((f) => !f.withinTolerance).length +
      c.lineItemDiffs.filter((d) => d.qtyVariance || d.priceVariance).length;
    entry.matchScores.push(c.score.matchScore);
    vendorMap.set(vendorName, entry);
  }

  const vendors = Array.from(vendorMap.entries()).map(([name, stats]) => {
    const accuracy =
      stats.matchScores.length > 0
        ? Math.round((stats.matchScores.reduce((a, b) => a + b, 0) / stats.matchScores.length) * 10) / 10
        : 0;
    return {
      name,
      accuracy,
      totalDocs: stats.totalDocs,
      discrepancies: stats.discrepancies,
      status: accuracy >= 97 ? "excellent" : accuracy >= 90 ? "good" : "needs-attention",
    };
  });

  return apiSuccess({
    auditEntries: auditEntries.map((a) => ({
      id: a._id.toString(),
      action: a.action,
      documentName: a.documentName,
      user: a.user,
      timestamp: a.createdAt.toISOString(),
      status: a.status,
      details: a.details,
      relatedComparisonId: a.relatedComparisonId?.toString() ?? null,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: totalAudits,
      totalPages: Math.max(1, Math.ceil(totalAudits / query.limit)),
    },
    comparisons: comparisons.map((c) => ({
      id: c._id.toString(),
      mode: c.mode,
      status: c.score.status,
      matchScore: c.score.matchScore,
      createdAt: c.createdAt.toISOString(),
    })),
    vendors,
    stats: {
      totalComparisons: comparisons.length,
      matched: comparisons.filter((c) => c.score.status === "Matched").length,
      partial: comparisons.filter((c) => c.score.status === "Partial").length,
      failed: comparisons.filter((c) => c.score.status === "Failed").length,
      avgMatchScore:
        comparisons.length > 0
          ? Math.round(comparisons.reduce((s, c) => s + c.score.matchScore, 0) / comparisons.length)
          : 0,
    },
  });
});
