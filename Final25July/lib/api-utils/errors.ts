import { ZodError } from "zod";
import { apiError } from "./response";

/**
 * Throw this from anywhere inside a route handler or service function to
 * produce a specific, well-formed HTTP error response. Anything else thrown
 * (a raw Error, a Mongo error, etc.) is treated as an unexpected 500.
 */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, opts: { status?: number; code?: string; details?: unknown } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status ?? 400;
    this.code = opts.code ?? "BAD_REQUEST";
    this.details = opts.details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(message, { status: 400, code: "BAD_REQUEST", details });
  }

  static notFound(message: string) {
    return new ApiError(message, { status: 404, code: "NOT_FOUND" });
  }

  static unauthorized(message = "You must be signed in to do that.") {
    return new ApiError(message, { status: 401, code: "UNAUTHORIZED" });
  }

  static forbidden(message = "You do not have permission to do that.") {
    return new ApiError(message, { status: 403, code: "FORBIDDEN" });
  }

  static conflict(message: string) {
    return new ApiError(message, { status: 409, code: "CONFLICT" });
  }

  static validation(message: string, details?: unknown) {
    return new ApiError(message, { status: 422, code: "VALIDATION_ERROR", details });
  }

  static upstream(message: string, details?: unknown) {
    return new ApiError(message, { status: 502, code: "UPSTREAM_ERROR", details });
  }

  static timeout(message = "The upstream service timed out.") {
    return new ApiError(message, { status: 504, code: "TIMEOUT" });
  }

  static internal(message = "Something went wrong.", details?: unknown) {
    return new ApiError(message, { status: 500, code: "INTERNAL_ERROR", details });
  }
}

/**
 * Wraps a Next.js Route Handler so every route gets identical, predictable
 * error handling without repeating try/catch boilerplate in every file.
 *
 * Usage:
 *   export const POST = withErrorHandling(async (req) => { ... });
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return apiError(err.message, { status: err.status, code: err.code, details: err.details });
  }

  if (err instanceof ZodError) {
    return apiError("Request validation failed.", {
      status: 422,
      code: "VALIDATION_ERROR",
      details: err.flatten(),
    });
  }

  if (err instanceof Error && err.name === "MongoServerError") {
    return apiError("Database error occurred.", {
      status: 500,
      code: "MONGO_ERROR",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }

  const message = err instanceof Error ? err.message : "Unexpected error.";
  console.error("[api] Unhandled error:", err);
  return apiError("An unexpected error occurred.", {
    status: 500,
    code: "INTERNAL_ERROR",
    details: process.env.NODE_ENV === "development" ? message : undefined,
  });
}
