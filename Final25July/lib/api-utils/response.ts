import { NextResponse } from "next/server";

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
}

export interface ApiErrorBody {
  success: false;
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
}

export function apiSuccess<T>(data: T, init?: number | ResponseInit) {
  const body: ApiSuccessBody<T> = { success: true, data };
  return NextResponse.json(body, typeof init === "number" ? { status: init } : init);
}

export function apiError(
  message: string,
  opts: { status?: number; code?: string; details?: unknown } = {}
) {
  const body: ApiErrorBody = {
    success: false,
    error: {
      message,
      code: opts.code ?? "INTERNAL_ERROR",
      details: opts.details,
    },
  };
  return NextResponse.json(body, { status: opts.status ?? 500 });
}
