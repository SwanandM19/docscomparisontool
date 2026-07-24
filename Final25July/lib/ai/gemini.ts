import { GoogleGenerativeAI, type Part, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { ApiError } from "@/lib/api-utils/errors";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw ApiError.internal("GEMINI_API_KEY is not configured on the server.");
  }
  if (!client) {
    client = new GoogleGenerativeAI(apiKey);
  }
  return client;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(ApiError.timeout(`Gemini request exceeded ${ms}ms.`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function withRetries<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      // Don't retry on validation/timeout errors we raised ourselves on the
      // final attempt, but do retry transient upstream/network failures.
      const isLastAttempt = attempt === retries;
      if (isLastAttempt) break;
      const backoffMs = 400 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  if (lastErr instanceof ApiError) throw lastErr;
  throw ApiError.upstream("Gemini API request failed after retries.", {
    cause: lastErr instanceof Error ? lastErr.message : String(lastErr),
  });
}

export interface GeminiTextOptions {
  systemInstruction?: string;
  temperature?: number;
  timeoutMs?: number;
  jsonMode?: boolean;
}

/**
 * Sends a plain text (+ optional inline file parts) prompt to Gemini and
 * returns the raw text response. Used by summary/recommendation/chat.
 */
export async function generateText(
  promptParts: (string | Part)[],
  opts: GeminiTextOptions = {}
): Promise<string> {
  const genAI = getClient();

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: opts.systemInstruction,
    generationConfig: {
      temperature: opts.temperature ?? 0.3,
      responseMimeType: opts.jsonMode ? "application/json" : "text/plain",
    },
    safetySettings: [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ],
  });

  return withRetries(async () => {
    const result = await withTimeout(
      model.generateContent(promptParts as (string | Part)[]),
      opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );
    const text = result.response.text();
    if (!text) {
      throw ApiError.upstream("Gemini returned an empty response.");
    }
    return text;
  });
}

/**
 * Convenience wrapper for JSON-structured generation. Strips markdown code
 * fences defensively (Gemini sometimes wraps JSON in ```json even in JSON
 * mode) and parses the result, throwing a clear ApiError if parsing fails.
 */
export async function generateJson<T>(
  promptParts: (string | Part)[],
  opts: GeminiTextOptions = {}
): Promise<T> {
  const raw = await generateText(promptParts, { ...opts, jsonMode: true });
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw ApiError.upstream("Failed to parse Gemini JSON response.", { raw: cleaned.slice(0, 500) });
  }
}

/**
 * Builds a Gemini `Part` for an inline file (PDF, image) fetched from a URL,
 * base64-encoding it as required by the Gemini API.
 */
export async function fileUrlToInlinePart(fileUrl: string, mimeType: string): Promise<Part> {
  const res = await fetch(fileUrl);
  if (!res.ok) {
    throw ApiError.upstream(`Failed to fetch file for extraction: ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return {
    inlineData: {
      data: base64,
      mimeType,
    },
  };
}
