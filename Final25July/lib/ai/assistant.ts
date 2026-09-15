import { generateText, GEMINI_MODEL_LITE } from "@/lib/ai/gemini";
import type { AssistantMessage } from "@/types/assistant";
import type { SessionUser } from "@/types/user";

const APP_OVERVIEW = `DocIntel is a document intelligence platform. Its main areas:
- Overview: full activity log and past comparisons.
- Document Comparator: the procurement flow. Upload a Purchase Order and an Invoice, or use the
  Universal / Contract presets. It runs a deterministic field-level and line-item comparison against
  configurable tolerance rules, then adds an AI executive summary, an Approve/Hold/Reject
  recommendation, and a grounded chat.
- Intelligent Comparison: upload any 2–5 documents of any type (résumé vs job description,
  contract revisions, report vs report, PO vs invoice, …). The AI reads each file, summarizes it,
  and produces a context-aware semantic comparison with aligned findings and a verdict.
- Settings → Tolerance Rules: thresholds (percentage or absolute) that decide when a numeric
  difference counts as a discrepancy.
- User Approvals (admins only): approve or reject pending sign-ups.
- Document Summary: upload one or more documents of any type (PO, Invoice, GRN, contract, report,
  letter …) and get a detailed structured summary of each — document type, parties, every important
  field and figure, line items, totals, dates, terms, and anything notable.
- Document Filler: upload any form/invoice/template, review the fields the AI detected (blank ones are
  flagged), type a value into each one, then fill and download the completed document as .txt, .rtf, or
  .pdf.`;

/**
 * Per-screen briefing the assistant prepends so answers are anchored to
 * whatever the user is looking at right now. Keys match the sidebar nav ids.
 */
const SECTION_GUIDES: Record<string, string> = {
  dashboard:
    "The user is on the Overview — the full activity log and the list of past comparisons. Help with filtering, and interpreting audit rows.",
  comparator:
    "The user is in the Document Comparator (procurement 2-way / 3-way / universal / contract matching). Help with uploading PO / Invoice / GRN, choosing a preset, reading the match score, field diffs, line-item variances, tolerance outcomes, the executive summary, the Approve/Hold/Reject recommendation, and the grounded workspace chat.",
  intelligent:
    "The user is in Intelligent Comparison (semantic comparison of any 2–5 documents). Help with staging files, the per-document summaries, aligned findings, the verdict rating, and key similarities/differences.",
  translate:
    "The user is in Document Translation (English ⇄ Marathi). Help with picking the direction, what is and isn't translated (numbers, GSTINs, dates stay verbatim), the confidence score, the direction-mismatch warning, and downloading the result as .rtf or .txt.",
  invoice:
    "The user is in the Document Filler. It works from a document they upload: they attach their own invoice / form / template, the AI detects its fields and flags which ones are blank, they type a value into each field, and on their click the AI fills the document and preserves its layout. Help with the upload, reviewing the detected fields, filling in blank vs. already-printed fields, and downloading the completed document as .txt, .rtf, or .pdf.",
  summary:
    "The user is in Document Summary. They upload one or more documents (any type) and get a detailed structured summary of each — document type, parties, key fields and figures, line items, totals, dates, terms, and notable points. Help with uploading and interpreting the summary.",
  settings:
    "The user is in Settings → Tolerance Rules. Help with percentage vs absolute thresholds, categories (pricing / quantity / dates / general), and how a rule decides whether a numeric difference is a discrepancy.",
  profile: "The user is on their User Profile — name, contact details, organisation, password.",
  approvals:
    "The user is on User Approvals (admin) — approving or rejecting pending sign-ups.",
};

function buildSystemInstruction(
  user: SessionUser,
  userContext: string,
  section?: string
): string {
  const sectionGuide =
    (section && SECTION_GUIDES[section]) ||
    "The user's current screen is unknown — answer generally.";

  return `You are the DocIntel Assistant, a helpful in-app chatbot for ${user.name} (${user.role}).

CURRENT SCREEN — prioritise questions about this area and assume the user means it unless they say otherwise:
${sectionGuide}

You can help with two things:
1. How to use DocIntel — explain features, guide the user to the right screen, describe what a
   result means. Use this reference:
${APP_OVERVIEW}

2. The user's own recent activity — answer questions about their comparisons and history using
   ONLY the context block below. If the answer is not in that context, say you don't have that
   information rather than guessing.

${userContext}

Style: concise and friendly, 2–5 sentences unless the user asks for a list or step-by-step.
Plain text only — no markdown of any kind: no headers, no bold/italic, and never use the "*" character
for emphasis or bullet points (write a plain sentence, or a numbered list with "1.", "2.", instead).
Never invent numbers, document names, or outcomes that are not in the context block. You cannot
perform actions (uploading, running comparisons, changing settings) — describe how the user can do
them.`;
}

export async function generateAssistantReply(
  user: SessionUser,
  history: AssistantMessage[],
  newMessage: string,
  userContext: string,
  section?: string
): Promise<string> {
  const conversation = history
    .slice(-12)
    .map((m) => `${m.sender === "user" ? "User" : "Assistant"}: ${m.text}`)
    .join("\n");

  const prompt = `${conversation ? `Conversation so far:\n${conversation}\n\n` : ""}User: ${newMessage}\n\nAssistant:`;

  const reply = await generateText([prompt], {
    systemInstruction: buildSystemInstruction(user, userContext, section),
    temperature: 0.5,
    timeoutMs: 25_000,
    model: GEMINI_MODEL_LITE,
  });

  // Hard guarantee on top of the system instruction: strip any stray
  // asterisks the model still slips in (markdown bold/bullets) rather than
  // relying on prompting alone.
  return reply.replace(/\*/g, "").replace(/[ \t]{2,}/g, " ").trim();
}
