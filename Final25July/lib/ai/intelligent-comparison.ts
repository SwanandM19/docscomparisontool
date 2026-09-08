import { z } from "zod";
import type { Part } from "@google/generative-ai";
import { generateJson } from "@/lib/ai/gemini";
import { buildFilePart } from "@/lib/ai/file-parts";
import { ApiError } from "@/lib/api-utils/errors";
import type {
  IntelligentSourceFile,
  IntelligentComparisonResult,
  IntelligentDocumentSummary,
} from "@/types/intelligent";

const documentSummarySchema = z.object({
  index: z.number().int().min(0),
  fileName: z.string(),
  detectedType: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  keyPoints: z.array(z.string()).default([]),
});

const alignedFindingSchema = z.object({
  aspect: z.string().min(1),
  status: z.enum(["match", "partial", "mismatch", "only_in_one"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  perDocument: z
    .array(z.object({ index: z.number().int().min(0), value: z.string() }))
    .default([]),
  details: z.string().min(1),
});

const responseSchema = z.object({
  documentSummaries: z.array(documentSummarySchema).min(1),
  comparison: z.object({
    documentsCompared: z.string().min(1),
    overview: z.string().min(1),
    alignedFindings: z.array(alignedFindingSchema).default([]),
    keySimilarities: z.array(z.string()).default([]),
    keyDifferences: z.array(z.string()).default([]),
    verdict: z.object({
      rating: z.enum(["Strong Match", "Partial Match", "Weak Match", "Divergent"]),
      rationale: z.string().min(1),
    }),
  }),
});

const SYSTEM_INSTRUCTION = `You are an expert document analyst. You are given TWO OR MORE documents
of ANY type (they might be a resume and a job description, two revisions of a contract, a purchase
order and an invoice, two research reports, a policy and an audit, etc.). Your job:

1. Understand what each document actually is, from its own content — do not assume they are
   procurement documents.
2. Write a clear, plain-language summary of each document on its own.
3. Compare the documents against each other in a way that makes sense for what they are: line up
   the aspects that correspond between them (requirements vs qualifications, ordered vs billed,
   old clause vs new clause, claim vs evidence, …) and explain where they agree, partly agree,
   conflict, or where something appears in only one document.

Ground every statement strictly in the documents' actual content — never invent figures, names,
dates, or clauses. Respond with ONLY a single JSON object matching the schema you are given — no
markdown, no code fences, no commentary.`;

function buildPrompt(files: IntelligentSourceFile[]): string {
  return `There are ${files.length} documents, indexed 0 to ${files.length - 1} in the order the
file parts appear after this message:
${files.map((file, i) => `  - index ${i}: ${file.fileName}`).join("\n")}

Return a JSON object with EXACTLY this shape:
{
  "documentSummaries": [
    {
      "index": number,                 // matches the document index above
      "fileName": string,
      "detectedType": string,          // what this document is, in your own words
      "title": string,                 // a short descriptive title
      "summary": string,               // 3-6 sentences, plain language, self-contained
      "keyPoints": string[]            // 3-6 of the most important facts/points
    }
  ],
  "comparison": {
    "documentsCompared": string,       // one line, e.g. "Resume vs Job Description"
    "overview": string,                // 2-4 sentences on how the documents relate overall
    "alignedFindings": [
      {
        "aspect": string,              // the thing being compared across documents
        "status": "match" | "partial" | "mismatch" | "only_in_one",
        "severity": "low" | "medium" | "high" | "critical",
        "perDocument": [ { "index": number, "value": string } ],  // each document's take on this aspect
        "details": string              // explain the relationship / discrepancy
      }
    ],
    "keySimilarities": string[],
    "keyDifferences": string[],
    "verdict": {
      "rating": "Strong Match" | "Partial Match" | "Weak Match" | "Divergent",
      "rationale": string
    }
  }
}

Rules:
- Produce one entry in "documentSummaries" for every document, in index order.
- "alignedFindings" should cover the aspects that matter for these specific document types — aim
  for 4 to 10 findings. Use "only_in_one" when an aspect is present in some documents but not
  others, and put the value "not present" for the documents that lack it.
- "severity" reflects how much a discrepancy matters for someone acting on these documents.
- Keep every string concise and factual.`;
}

export async function runIntelligentComparison(files: IntelligentSourceFile[]): Promise<{
  documentSummaries: IntelligentDocumentSummary[];
  comparison: IntelligentComparisonResult;
}> {
  if (files.length < 2) {
    throw ApiError.badRequest("Intelligent comparison needs at least 2 documents.");
  }

  const fileParts = await Promise.all(files.map(buildFilePart));
  const promptParts: (string | Part)[] = [buildPrompt(files), ...fileParts];

  let parsed;
  try {
    const raw = await generateJson<unknown>(promptParts, {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.25,
      timeoutMs: 90_000,
    });
    parsed = responseSchema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      throw ApiError.upstream(
        "The AI comparison response did not match the expected format.",
        err.flatten()
      );
    }
    throw err;
  }

  // Normalize summaries to one-per-file, index-ordered, filling any the model
  // skipped so the UI always has an entry per document.
  const byIndex = new Map(parsed.documentSummaries.map((s) => [s.index, s]));
  const documentSummaries: IntelligentDocumentSummary[] = files.map((file, i) => {
    const s = byIndex.get(i);
    return {
      index: i,
      fileName: file.fileName,
      detectedType: s?.detectedType ?? "Unrecognized document",
      title: s?.title ?? file.fileName,
      summary: s?.summary ?? "No summary could be generated for this document.",
      keyPoints: s?.keyPoints ?? [],
    };
  });

  return { documentSummaries, comparison: parsed.comparison };
}
