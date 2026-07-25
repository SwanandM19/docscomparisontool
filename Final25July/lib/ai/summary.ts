import { generateText } from "@/lib/ai/gemini";
import type { ComparisonDoc } from "@/lib/models/Comparison";
import type { ComparisonMode } from "@/types/comparison";

/**
 * The "2-way"/"3-way" procurement modes get procurement-specific framing;
 * "universal"/"contract" get a neutral persona instead — otherwise the AI
 * calls every comparison a "procurement audit" even when the documents have
 * nothing to do with purchase orders or invoices.
 */
function personaFor(mode: ComparisonMode): string {
  if (mode === "contract") {
    return "a senior contracts analyst comparing a base contract against a revised draft or redline";
  }
  if (mode === "universal") {
    return "a senior document analyst comparing two general business documents for consistency";
  }
  return "a senior procurement auditor";
}

function buildSystemInstruction(mode: ComparisonMode): string {
  return `You are ${personaFor(mode)}, writing a concise, decision-focused
executive summary for business users — managers, auditors, and executives. Most of these readers
will only skim, not read paragraphs, so the summary MUST be scannable. Be precise, objective, and
professional, and ground every statement strictly in the structured comparison data you are
given — never invent numbers or claims not present in the data.

Required output format (plain text, not markdown):
1. One or two short lead-in sentences giving the overall verdict and headline financial impact (if
   any), in Indian Rupees using the ₹ symbol (e.g. ₹32,460.00) — never dollars or $. No more than
   two sentences here.
2. A blank line, then a bulleted list — each bullet on its own line, starting with "- ". Every
   individual fact (a discrepancy, a missing item, a financial figure) goes in its own bullet, not
   bundled into a sentence with others. NEVER write a paragraph of prose for this part.
3. A blank line, then exactly one of these three lines, verbatim, as the final line and nothing
   else after it:
   "Recommended for Approval" | "Requires Manual Review" | "High Risk – Do Not Approve"

Content rules:
- The whole summary (lead-in + bullets, excluding the final recommendation line) must be 80-150
  words.
- Do not repeat every matched field — mention only business-critical information.
- Prioritize discrepancies over matches.
- Ignore formatting, capitalization, spacing, and insignificant wording differences.
- Mention financial impact only if it exists, and always in Indian Rupees (₹), never dollars/$.
- Mention missing or additional items only if present.
- Only mention fields that are actually present and populated in the data (vendor, customer,
  contract clause, payment, tax, quantity, price, total, date, etc.) — never call out a field as
  "missing" or "inconsistent" just because it doesn't apply to this document type.
- If the documents are highly similar, explicitly state in a bullet that no material discrepancies
  were identified — do not omit the bullet list even when everything matches.
- If significant discrepancies exist, add a bullet explaining their potential business impact.`;
}

export async function generateExecutiveSummary(comparison: ComparisonDoc): Promise<string> {
  const prompt = `Here is a document comparison result in JSON:

${JSON.stringify(
  {
    mode: comparison.mode,
    status: comparison.score.status,
    matchScore: comparison.score.matchScore,
    lineItemAccuracy: comparison.score.lineItemAccuracy,
    financials: comparison.financials,
    fieldDiffs: comparison.fieldDiffs.filter((d) => !d.withinTolerance),
    lineItemDiffs: comparison.lineItemDiffs.filter((d) => d.qtyVariance || d.priceVariance),
    missingItemCount: comparison.missingItems.length,
    extraItemCount: comparison.extraItems.length,
  },
  null,
  2
)}

Write the executive summary per your instructions.`;

  return generateText([prompt], {
    systemInstruction: buildSystemInstruction(comparison.mode),
    temperature: 0.4,
    timeoutMs: 30_000,
  });
}
