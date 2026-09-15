import { v4 as uuid } from "uuid";
import { connectToDatabase } from "@/lib/db/mongodb";
import { AssistantConversationModel } from "@/lib/models/AssistantConversation";
import { ComparisonModel } from "@/lib/models/Comparison";
import { IntelligentComparisonModel } from "@/lib/models/IntelligentComparison";
import { AuditLogModel } from "@/lib/models/AuditLog";
import { apiSuccess } from "@/lib/api-utils/response";
import { ApiError, withErrorHandling } from "@/lib/api-utils/errors";
import { assistantChatSchema } from "@/lib/api-utils/validation";
import { generateAssistantReply } from "@/lib/ai/assistant";
import { getCurrentUser } from "@/lib/auth/current-user";
import type { SessionUser } from "@/types/user";

const MAX_STORED_MESSAGES = 60;

/**
 * Builds a compact, plain-text snapshot of the signed-in user's own recent
 * DocIntel activity for the assistant to ground answers on. Scoped strictly
 * to the user's own records — the assistant never sees other users' data.
 */
async function buildUserContext(user: SessionUser): Promise<string> {
  const [comparisons, intelligent, audits] = await Promise.all([
    ComparisonModel.find({ createdBy: user.email }).sort({ createdAt: -1 }).limit(10),
    IntelligentComparisonModel.find({ createdBy: user.email }).sort({ createdAt: -1 }).limit(5),
    AuditLogModel.find({ user: user.email }).sort({ createdAt: -1 }).limit(10),
  ]);

  const totalComparisons = await ComparisonModel.countDocuments({ createdBy: user.email });

  const lines: string[] = ["USER ACTIVITY CONTEXT (the signed-in user's own records only):"];

  lines.push(
    `- Procurement comparisons run: ${totalComparisons} total (${comparisons.length} most recent shown).`
  );
  comparisons.forEach((c, i) => {
    const discrepancies =
      c.fieldDiffs.filter((f) => !f.withinTolerance).length +
      c.lineItemDiffs.filter((d) => d.qtyVariance || d.priceVariance).length;
    lines.push(
      `  ${i + 1}. ${c.documentKinds.join(" vs ")} — ${c.mode}, status ${c.score.status}, ` +
        `match ${c.score.matchScore}%, ${discrepancies} discrepancy(ies), ` +
        `${new Date(c.createdAt).toISOString().slice(0, 10)}` +
        (c.aiRecommendation ? `, recommendation: ${c.aiRecommendation.decision}` : "")
    );
  });

  // Full field-level and line-item detail for the single most recent
  // comparison, so the assistant can actually answer "what's different"
  // instead of only knowing a discrepancy count.
  const latestComparison = comparisons[0];
  if (latestComparison) {
    lines.push(
      `- Full detail for the most recent comparison (${latestComparison.documentKinds.join(" vs ")}, ${new Date(latestComparison.createdAt).toISOString().slice(0, 10)}):`
    );
    const mismatched = latestComparison.fieldDiffs.filter((f) => !f.withinTolerance).slice(0, 25);
    if (mismatched.length > 0) {
      lines.push("  Field differences (outside tolerance):");
      mismatched.forEach((f) => {
        lines.push(
          `    • ${f.fieldName}: doc A = ${f.docAValue ?? "—"}, doc B = ${f.docBValue ?? "—"}` +
            (f.docCValue != null ? `, doc C = ${f.docCValue}` : "") +
            ` (${f.severity} severity, ${f.differenceType}) — ${f.rootCause}`
        );
      });
    }
    const variantItems = latestComparison.lineItemDiffs
      .filter((d) => d.qtyVariance || d.priceVariance)
      .slice(0, 25);
    if (variantItems.length > 0) {
      lines.push("  Line item differences:");
      variantItems.forEach((d) => {
        lines.push(
          `    • ${d.description}: PO qty ${d.poQty ?? "—"} vs Inv qty ${d.invQty ?? "—"}` +
            (d.grnQty != null ? ` vs GRN qty ${d.grnQty}` : "") +
            `, PO price ${d.poPrice ?? "—"} vs Inv price ${d.invPrice ?? "—"} — ${d.explanation}`
        );
      });
    }
    if (mismatched.length === 0 && variantItems.length === 0) {
      lines.push("  No field or line-item differences outside tolerance were found.");
    }
    if (latestComparison.aiSummary) {
      lines.push(`  Executive summary: ${latestComparison.aiSummary}`);
    }
  }

  if (intelligent.length > 0) {
    lines.push(`- Intelligent comparisons: ${intelligent.length} recent.`);
    intelligent.forEach((r, i) => {
      lines.push(
        `  ${i + 1}. ${r.comparison.documentsCompared} — verdict ${r.comparison.verdict.rating}, ` +
          `${r.comparison.alignedFindings.length} aligned finding(s), ` +
          `${new Date(r.createdAt).toISOString().slice(0, 10)}`
      );
    });

    // Full detail for the single most recent intelligent comparison — the
    // aligned findings, similarities, and differences themselves, not just
    // their counts, so questions like "what are the differences" are
    // actually answerable rather than deflected.
    const latestIntelligent = intelligent[0];
    lines.push(
      `- Full detail for the most recent intelligent comparison (${latestIntelligent.comparison.documentsCompared}, ${new Date(latestIntelligent.createdAt).toISOString().slice(0, 10)}):`
    );
    lines.push(`  Overview: ${latestIntelligent.comparison.overview}`);
    lines.push(
      `  Verdict: ${latestIntelligent.comparison.verdict.rating} — ${latestIntelligent.comparison.verdict.rationale}`
    );
    if (latestIntelligent.comparison.alignedFindings.length > 0) {
      lines.push("  Aligned findings:");
      latestIntelligent.comparison.alignedFindings.slice(0, 25).forEach((f) => {
        const perDoc = f.perDocument
          .map((pd) => {
            const doc = latestIntelligent.documentSummaries.find((d) => d.index === pd.index);
            return `${doc?.title ?? `Document ${pd.index + 1}`}: ${pd.value}`;
          })
          .join(" | ");
        lines.push(`    • ${f.aspect} (${f.status}, ${f.severity}): ${f.details}${perDoc ? ` [${perDoc}]` : ""}`);
      });
    }
    if (latestIntelligent.comparison.keySimilarities.length > 0) {
      lines.push(`  Key similarities: ${latestIntelligent.comparison.keySimilarities.join("; ")}`);
    }
    if (latestIntelligent.comparison.keyDifferences.length > 0) {
      lines.push(`  Key differences: ${latestIntelligent.comparison.keyDifferences.join("; ")}`);
    }
  }

  if (audits.length > 0) {
    lines.push("- Recent activity log:");
    audits.forEach((a) => {
      lines.push(
        `  • ${new Date(a.createdAt).toISOString().slice(0, 10)} — ${a.action}: ${a.documentName} (${a.status})`
      );
    });
  }

  if (comparisons.length === 0 && intelligent.length === 0) {
    lines.push("- The user has not run any comparisons yet.");
  }

  return lines.join("\n");
}

// ── GET: load the user's rolling conversation ──
export const GET = withErrorHandling(async () => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  await connectToDatabase();

  const conversation = await AssistantConversationModel.findOne({ ownerEmail: session.email });

  return apiSuccess({
    messages: conversation?.messages ?? [],
    updatedAt: conversation?.updatedAt?.toISOString() ?? null,
  });
});

// ── POST: send a message, get the assistant's reply ──
export const POST = withErrorHandling(async (req: Request) => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  const body = assistantChatSchema.parse(await req.json());

  await connectToDatabase();

  const conversation =
    (await AssistantConversationModel.findOne({ ownerEmail: session.email })) ??
    new AssistantConversationModel({ ownerEmail: session.email, messages: [] });

  const userMessage = {
    id: uuid(),
    sender: "user" as const,
    text: body.message,
    timestamp: new Date().toISOString(),
  };
  conversation.messages.push(userMessage);

  const userContext = await buildUserContext(session);
  const replyText = await generateAssistantReply(
    session,
    conversation.messages,
    body.message,
    userContext,
    body.section
  );

  const aiMessage = {
    id: uuid(),
    sender: "ai" as const,
    text: replyText,
    timestamp: new Date().toISOString(),
  };
  conversation.messages.push(aiMessage);

  // Keep the stored history bounded.
  if (conversation.messages.length > MAX_STORED_MESSAGES) {
    conversation.messages = conversation.messages.slice(-MAX_STORED_MESSAGES);
  }

  await conversation.save();

  return apiSuccess({ message: aiMessage, messages: conversation.messages });
});

// ── DELETE: clear the conversation ──
export const DELETE = withErrorHandling(async () => {
  const session = await getCurrentUser();
  if (!session) throw ApiError.unauthorized();

  await connectToDatabase();

  await AssistantConversationModel.updateOne(
    { ownerEmail: session.email },
    { $set: { messages: [] } },
    { upsert: true }
  );

  return apiSuccess({ cleared: true });
});
