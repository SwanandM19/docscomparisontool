import { generateText } from "@/lib/ai/gemini";
import type { ComparisonDoc } from "@/lib/models/Comparison";
import type { ChatMessageRecord } from "@/types/comparison";

const SYSTEM_INSTRUCTION = `You are a grounded AI assistant embedded in a document-audit workspace.
You must answer questions using ONLY the structured comparison data provided in context — never
speculate beyond it. If asked something the data can't answer, say so plainly rather than guessing.
Keep answers concise (2-4 sentences unless the user asks for a list/detail). You may draft short
emails to vendors when asked, referencing the specific discrepancies in the data. Do not use
markdown headers.`;

function buildContext(comparison: ComparisonDoc): string {
  return JSON.stringify(
    {
      mode: comparison.mode,
      status: comparison.score.status,
      matchScore: comparison.score.matchScore,
      financials: comparison.financials,
      fieldDiffs: comparison.fieldDiffs,
      lineItemDiffs: comparison.lineItemDiffs,
      missingItems: comparison.missingItems,
      extraItems: comparison.extraItems,
      aiSummary: comparison.aiSummary,
      aiRecommendation: comparison.aiRecommendation,
    },
    null,
    2
  );
}

export async function generateChatReply(
  comparison: ComparisonDoc,
  history: ChatMessageRecord[],
  newMessage: string
): Promise<string> {
  const contextBlock = `Comparison data (ground truth — do not deviate from this):\n${buildContext(comparison)}`;

  const conversation = history
    .slice(-10) // keep the prompt bounded
    .map((m) => `${m.sender === "user" ? "User" : "Assistant"}: ${m.text}`)
    .join("\n");

  const prompt = `${contextBlock}\n\nConversation so far:\n${conversation}\n\nUser: ${newMessage}\n\nAssistant:`;

  return generateText([prompt], {
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.4,
    timeoutMs: 25_000,
  });
}
