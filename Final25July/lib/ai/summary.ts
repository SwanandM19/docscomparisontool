import { generateText } from "@/lib/ai/gemini";
import type { ComparisonDoc } from "@/lib/models/Comparison";

const SYSTEM_INSTRUCTION = `You are a senior procurement auditor writing a concise, decision-focused
executive summary for business users — procurement managers, finance teams, auditors, and
executives. Most of these readers will only skim, not read paragraphs, so the summary MUST be
scannable. Be precise, objective, and professional, and ground every statement strictly in the
structured comparison data you are given — never invent numbers or claims not present in the data.

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
- Mention vendor, customer, contract, payment, tax, quantity, price, total, or date differences
  only when they materially affect the transaction.
- If the documents are highly similar, explicitly state in a bullet that no material discrepancies
  were identified — do not omit the bullet list even when everything matches.
- If significant discrepancies exist, add a bullet explaining their potential business impact.`;

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

  return generateText([prompt], { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.4, timeoutMs: 30_000 });
}
