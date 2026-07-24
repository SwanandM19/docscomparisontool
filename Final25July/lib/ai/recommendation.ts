import { z } from "zod";
import { generateJson } from "@/lib/ai/gemini";
import { ApiError } from "@/lib/api-utils/errors";
import type { ComparisonDoc } from "@/lib/models/Comparison";

const recommendationSchema = z.object({
  decision: z.enum(["Approve", "Hold", "Reject"]),
  reason: z.string().min(1),
});

export type Recommendation = z.infer<typeof recommendationSchema>;

const SYSTEM_INSTRUCTION = `You are an AI procurement approval assistant. Given a deterministic
document comparison result (already computed — you are NOT recomputing the comparison, only
recommending an action), decide whether the invoice/document set should be Approved, Held for
review, or Rejected. Base your decision only on the provided data. Respond with ONLY a JSON
object: { "decision": "Approve" | "Hold" | "Reject", "reason": string }. The reason must be one
or two sentences, specific to the actual discrepancies found, written for a finance approver.`;

/**
 * Fallback deterministic rule used if the AI call fails or returns something
 * invalid — the recommendation feature should degrade gracefully rather
 * than blocking the whole comparison flow.
 */
function deterministicFallback(comparison: ComparisonDoc): Recommendation {
  if (comparison.score.status === "Failed") {
    return {
      decision: "Reject",
      reason: `Match score of ${comparison.score.matchScore}% falls below the acceptable threshold, indicating material discrepancies that require vendor correction before payment.`,
    };
  }
  if (comparison.score.status === "Partial") {
    return {
      decision: "Hold",
      reason: `Match score of ${comparison.score.matchScore}% with ${comparison.lineItemDiffs.filter((d) => d.qtyVariance || d.priceVariance).length} line-item variance(s) detected — recommend manual review before approval.`,
    };
  }
  return {
    decision: "Approve",
    reason: `All fields and line items matched within configured tolerances (${comparison.score.matchScore}% match score). Safe to approve for payment.`,
  };
}

export async function generateRecommendation(comparison: ComparisonDoc): Promise<Recommendation> {
  const prompt = `Comparison result:

${JSON.stringify(
  {
    status: comparison.score.status,
    matchScore: comparison.score.matchScore,
    financials: comparison.financials,
    fieldDiffs: comparison.fieldDiffs.filter((d) => !d.withinTolerance),
    lineItemDiffs: comparison.lineItemDiffs.filter((d) => d.qtyVariance || d.priceVariance),
    missingItemCount: comparison.missingItems.length,
    extraItemCount: comparison.extraItems.length,
  },
  null,
  2
)}

Recommend Approve, Hold, or Reject with a one-to-two sentence reason.`;

  try {
    const raw = await generateJson<unknown>([prompt], {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.2,
      timeoutMs: 25_000,
    });
    return recommendationSchema.parse(raw);
  } catch (err) {
    if (err instanceof ApiError) {
      // Upstream/timeout failure — degrade to deterministic rule rather than
      // failing the whole request.
      return deterministicFallback(comparison);
    }
    throw err;
  }
}
