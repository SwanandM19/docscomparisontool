import { GoogleGenerativeAI, type Part, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { ApiError } from "@/lib/api-utils/errors";

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
/**
 * Cheaper model for low-stakes, non-extraction calls (chatbots,
 * already-computed-data summaries) — see costing.md §8. Callers opt in via
 * `{ model: GEMINI_MODEL_LITE }`; anything that doesn't pass `model` keeps
 * using the full GEMINI_MODEL above.
 *
 * NOTE: "gemini-2.5-flash-lite" returns 404 ("no longer available to new
 * users") on at least one live project key as of 2026-09 — Google's model
 * lineup has moved to a 3.x generation. "gemini-3.1-flash-lite" is verified
 * reachable and is the cheapest *accessible* option (confirmed against a
 * live key); "gemini-3.5-flash-lite" also works but is priced the same as
 * plain gemini-2.5-flash, so it saves nothing. Re-verify against your own
 * key before assuming any specific model name still resolves.
 */
export const GEMINI_MODEL_LITE = process.env.GEMINI_MODEL_LITE || "gemini-3.1-flash-lite";
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

/**
 * Turns a raw SDK error into a specific ApiError when it's clearly not worth
 * retrying (bad key, quota / billing cap, permission). Returns null when the
 * failure looks transient and a retry might help.
 */
/**
 * True for a 429/RESOURCE_EXHAUSTED/"rate limit" response. Gemini uses this
 * same wording for both a momentary per-minute rate-limit (which clears
 * itself in seconds) and genuine billing/quota exhaustion, so it can't be
 * told apart from the message alone — treated as transient and retried;
 * only reported as exhausted if it's still failing after retries.
 */
function isRateLimitError(msg: string): boolean {
  return /spending cap|quota|RESOURCE_EXHAUSTED|\b429\b|rate limit|exceeded/i.test(msg);
}

/**
 * Classifies a genuinely non-retryable failure (bad key, no model access,
 * safety filter) so it can be surfaced immediately instead of burning
 * retries on something that will never succeed. Rate-limit/quota errors are
 * deliberately NOT classified here — they're handled as retryable in
 * withRetries below.
 */
function classifyGeminiError(err: unknown): ApiError | null {
  const msg = err instanceof Error ? err.message : String(err);

  if (/API_KEY_INVALID|API key not valid|invalid api key/i.test(msg)) {
    return ApiError.internal(
      "The Gemini API key on the server is invalid. Update GEMINI_API_KEY in .env.local."
    );
  }
  if (/permission|PERMISSION_DENIED|\b403\b/i.test(msg)) {
    return ApiError.upstream("The Gemini API key does not have access to this model.", {
      cause: msg,
    });
  }
  if (/SAFETY|blocked|recitation/i.test(msg)) {
    return ApiError.upstream("The AI declined to process this document (safety filter).", {
      cause: msg,
    });
  }
  return null;
}

async function withRetries<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      // Non-transient failures (bad key, no model access, safety filter)
      // won't fix themselves — surface them immediately with a clear message.
      const classified = classifyGeminiError(err);
      if (classified) throw classified;

      // A rate-limit hit gets a longer backoff than a plain network blip,
      // since per-minute caps take a few seconds to clear.
      const msg = err instanceof Error ? err.message : String(err);
      const rateLimited = isRateLimitError(msg);

      const isLastAttempt = attempt === retries;
      if (isLastAttempt) break;
      const backoffMs = (rateLimited ? 1500 : 400) * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }

  if (lastErr instanceof ApiError) throw lastErr;

  const lastMsg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  if (isRateLimitError(lastMsg)) {
    throw new ApiError(
      "The AI service is temporarily unavailable — its usage quota or billing cap has been reached. " +
        "Raise the spend cap at ai.studio/spend (or switch GEMINI_API_KEY to a project with budget), then try again.",
      { status: 503, code: "AI_QUOTA_EXCEEDED", details: { cause: lastMsg } }
    );
  }

  throw ApiError.upstream(
    `Gemini API request failed${lastMsg ? `: ${lastMsg}` : " after retries."}`,
    { cause: lastMsg }
  );
}

export interface GeminiTextOptions {
  systemInstruction?: string;
  temperature?: number;
  timeoutMs?: number;
  jsonMode?: boolean;
  /** Defaults to GEMINI_MODEL; pass GEMINI_MODEL_LITE for low-stakes calls. */
  model?: string;
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
    model: opts.model ?? GEMINI_MODEL,
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
