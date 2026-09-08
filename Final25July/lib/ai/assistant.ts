import { generateText } from "@/lib/ai/gemini";
import type { AssistantMessage } from "@/types/assistant";
import type { SessionUser } from "@/types/user";

const APP_OVERVIEW = `DocIntel is a document intelligence platform. Its main areas:
- Dashboard Overview: at-a-glance stats and recent comparisons.
- Document Comparator: the procurement flow. Upload a Purchase Order and an Invoice (optionally a
  Goods Receipt Note for 3-way matching), or use the Universal / Contract presets. It runs a
  deterministic field-level and line-item comparison against configurable tolerance rules, then
  adds an AI executive summary, an Approve/Hold/Reject recommendation, and a grounded chat.
- Intelligent Comparison: upload any 2–5 documents of any type (résumé vs job description,
  contract revisions, report vs report, PO vs invoice, …). The AI reads each file, summarizes it,
  and produces a context-aware semantic comparison with aligned findings and a verdict.
- History & Audits: full activity log and past comparisons.
- Vendor Analytics: vendor accuracy and discrepancy trends derived from comparison history.
- Settings → Tolerance Rules: thresholds (percentage or absolute) that decide when a numeric
  difference counts as a discrepancy.
- User Approvals (admins only): approve or reject pending sign-ups.`;

function buildSystemInstruction(user: SessionUser, userContext: string): string {
  return `You are the DocIntel Assistant, a helpful in-app chatbot for ${user.name} (${user.role}).

You can help with two things:
1. How to use DocIntel — explain features, guide the user to the right screen, describe what a
   result means. Use this reference:
${APP_OVERVIEW}

2. The user's own recent activity — answer questions about their comparisons and history using
   ONLY the context block below. If the answer is not in that context, say you don't have that
   information rather than guessing.

${userContext}

Style: concise and friendly, 2–5 sentences unless the user asks for a list or step-by-step.
Plain text — no markdown headers. Never invent numbers, document names, or outcomes that are not
in the context block. You cannot perform actions (uploading, running comparisons, changing
settings) — describe how the user can do them.`;
}

export async function generateAssistantReply(
  user: SessionUser,
  history: AssistantMessage[],
  newMessage: string,
  userContext: string
): Promise<string> {
  const conversation = history
    .slice(-12)
    .map((m) => `${m.sender === "user" ? "User" : "Assistant"}: ${m.text}`)
    .join("\n");

  const prompt = `${conversation ? `Conversation so far:\n${conversation}\n\n` : ""}User: ${newMessage}\n\nAssistant:`;

  return generateText([prompt], {
    systemInstruction: buildSystemInstruction(user, userContext),
    temperature: 0.5,
    timeoutMs: 25_000,
  });
}
