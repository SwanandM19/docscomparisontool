import type { ComparisonScore, FieldDiff, LineItemDiff, MatchStatus } from "@/types/comparison";

/**
 * Weighted scoring model:
 * - Field-level diffs contribute to the header match score (vendor, dates,
 *   PO/invoice numbers, totals, tax) since these determine document identity
 *   and financial correctness.
 * - Line-item diffs contribute to line-item accuracy specifically.
 * - Severity weights: critical=1.0, high=0.75, medium=0.4, low=0.15 penalty
 *   per affected field/item, floored at 0.
 */
const SEVERITY_PENALTY: Record<FieldDiff["severity"], number> = {
  critical: 1,
  high: 0.75,
  medium: 0.4,
  low: 0.15,
};

export function computeMatchScore(
  fieldDiffs: FieldDiff[],
  lineItemDiffs: LineItemDiff[],
  extractionConfidences: number[],
  missingItemCount: number,
  extraItemCount: number
): ComparisonScore {
  // ── Header/field match score ──
  const totalFields = Math.max(fieldDiffs.length, 1);
  const fieldPenalty = fieldDiffs.reduce((sum, d) => {
    if (d.withinTolerance) return sum;
    return sum + SEVERITY_PENALTY[d.severity];
  }, 0);
  const fieldScore = Math.max(0, 100 - (fieldPenalty / totalFields) * 100);

  // ── Line item accuracy ──
  const totalLineItems = Math.max(lineItemDiffs.length + missingItemCount + extraItemCount, 1);
  let lineItemPenalty = 0;
  for (const item of lineItemDiffs) {
    if (item.qtyVariance) lineItemPenalty += SEVERITY_PENALTY[item.severity] * 0.5;
    if (item.priceVariance) lineItemPenalty += SEVERITY_PENALTY[item.severity] * 0.5;
  }
  // Missing/extra items are always a full-severity penalty (critical data integrity issue).
  lineItemPenalty += missingItemCount * SEVERITY_PENALTY.critical;
  lineItemPenalty += extraItemCount * SEVERITY_PENALTY.high;

  const lineItemAccuracy = Math.max(0, 100 - (lineItemPenalty / totalLineItems) * 100);

  // ── Overall match score: weighted average (60% line items, 40% header fields) ──
  const matchScore = Math.round(fieldScore * 0.4 + lineItemAccuracy * 0.6);

  // ── Confidence: derived from AI extraction confidence of all input documents ──
  const confidenceScore =
    extractionConfidences.length > 0
      ? Math.round(extractionConfidences.reduce((a, b) => a + b, 0) / extractionConfidences.length)
      : 0;

  // ── Status classification ──
  let status: MatchStatus = "Matched";
  const hasCritical = [...fieldDiffs].some((d) => !d.withinTolerance && d.severity === "critical");
  if (hasCritical || matchScore < 60) {
    status = "Failed";
  } else if (matchScore < 95) {
    status = "Partial";
  }

  return {
    matchScore: Math.round(matchScore),
    lineItemAccuracy: Math.round(lineItemAccuracy),
    confidenceScore,
    status,
  };
}
