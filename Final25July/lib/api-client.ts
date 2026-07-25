"use client";

import type { ExtractedDocumentData, DocumentKind } from "@/types/document";
import type { SessionUser, UserRecord } from "@/types/user";
import type {
  ComparisonMode,
  FieldDiff,
  LineItemDiff,
  ComparisonScore,
  ToleranceRuleInput,
  ChatMessageRecord,
} from "@/types/comparison";

export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body?.success) {
    const message = body?.error?.message ?? `Request failed with status ${res.status}`;
    throw new ApiClientError(message, res.status, body?.error?.code ?? "UNKNOWN", body?.error?.details);
  }

  return body.data as T;
}

// ── /api/upload ──
export interface UploadResponse {
  documentId: string;
  kind: DocumentKind;
  fileUrl: string;
  fileName: string;
  fileType: "pdf" | "image" | "excel";
  status: string;
}

export function registerUpload(payload: {
  kind: DocumentKind;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}) {
  return request<UploadResponse>("/api/upload", { method: "POST", body: JSON.stringify(payload) });
}

// ── /api/extract ──
export interface ExtractResponse {
  documentId: string;
  status: string;
  extractedData: ExtractedDocumentData;
  extractionConfidence: number;
}

export function extractDocument(documentId: string) {
  return request<ExtractResponse>("/api/extract", { method: "POST", body: JSON.stringify({ documentId }) });
}

// ── /api/compare ──
export interface CompareResponse {
  comparisonId: string;
  mode: ComparisonMode;
  score: ComparisonScore;
  financials: { totalExpected: number; totalInvoiced: number; netVariance: number; potentialSavings: number };
  fieldDiffs: FieldDiff[];
  lineItemDiffs: LineItemDiff[];
  missingItems: unknown[];
  extraItems: unknown[];
}

export function runCompare(payload: {
  mode: ComparisonMode;
  documentIds: string[];
  presetUsed: string;
  toleranceRules?: ToleranceRuleInput[];
}) {
  return request<CompareResponse>("/api/compare", { method: "POST", body: JSON.stringify(payload) });
}

// ── /api/comparison/:id ──
export interface ComparisonDetailResponse extends CompareResponse {
  _id: string;
  documentIds: string[];
  documentKinds: DocumentKind[];
  documents: {
    _id: string;
    kind: DocumentKind;
    fileName: string;
    fileUrl: string;
    extractedData: ExtractedDocumentData | null;
    extractionConfidence: number | null;
  }[];
  presetUsed: string;
  toleranceRules: ToleranceRuleInput[];
  aiSummary: string | null;
  aiRecommendation: { decision: "Approve" | "Hold" | "Reject"; reason: string } | null;
  chatHistory: ChatMessageRecord[];
  createdAt: string;
  createdBy: string;
}

export function getComparison(id: string) {
  return request<ComparisonDetailResponse>(`/api/comparison/${id}`);
}

// ── /api/summary ──
export function generateSummary(comparisonId: string) {
  return request<{ comparisonId: string; aiSummary: string }>("/api/summary", {
    method: "POST",
    body: JSON.stringify({ comparisonId }),
  });
}

// ── /api/recommendation ──
export function generateRecommendation(comparisonId: string) {
  return request<{
    comparisonId: string;
    aiRecommendation: { decision: "Approve" | "Hold" | "Reject"; reason: string };
  }>("/api/recommendation", { method: "POST", body: JSON.stringify({ comparisonId }) });
}

// ── /api/chat ──
export function sendChatMessage(comparisonId: string, message: string) {
  return request<{ comparisonId: string; message: ChatMessageRecord; chatHistory: ChatMessageRecord[] }>(
    "/api/chat",
    { method: "POST", body: JSON.stringify({ comparisonId, message }) }
  );
}

// ── /api/export ──
export async function exportComparisonPdf(comparisonId: string): Promise<Blob> {
  const res = await fetch("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ comparisonId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiClientError(
      body?.error?.message ?? "Export failed",
      res.status,
      body?.error?.code ?? "EXPORT_FAILED"
    );
  }
  return res.blob();
}

// ── /api/history ──
export interface HistoryResponse {
  auditEntries: {
    id: string;
    action: string;
    documentName: string;
    user: string;
    timestamp: string;
    status: "completed" | "warning" | "pending";
    details: string;
    relatedComparisonId: string | null;
  }[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  comparisons: { id: string; mode: ComparisonMode; status: string; matchScore: number; createdAt: string }[];
  vendors: { name: string; accuracy: number; totalDocs: number; discrepancies: number; status: string }[];
  stats: { totalComparisons: number; matched: number; partial: number; failed: number; avgMatchScore: number };
}

export function getHistory(params: { page?: number; limit?: number; status?: string } = {}) {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.status) search.set("status", params.status);
  return request<HistoryResponse>(`/api/history?${search.toString()}`);
}

// ── /api/tolerance-rules ──
export interface ToleranceRuleDto extends ToleranceRuleInput {
  id: string;
}

export function getToleranceRules() {
  return request<{ rules: ToleranceRuleDto[] }>("/api/tolerance-rules");
}

export function updateToleranceRules(rules: ToleranceRuleDto[]) {
  return request<{ rules: ToleranceRuleDto[] }>("/api/tolerance-rules", {
    method: "PUT",
    body: JSON.stringify({ rules }),
  });
}

export function createToleranceRule(rule: ToleranceRuleInput) {
  return request<{ rule: ToleranceRuleDto }>("/api/tolerance-rules", {
    method: "POST",
    body: JSON.stringify(rule),
  });
}

export function deleteToleranceRule(id: string) {
  return request<{ id: string }>(`/api/tolerance-rules?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ── /api/auth ──
// [ADMIN-APPROVAL] The `{ pendingApproval: true }` branch of this return type
// only exists for that feature — narrow this back to plain `SessionUser` if
// it's retired.
export function signup(payload: { name: string; email: string; password: string }) {
  return request<SessionUser | { pendingApproval: true }>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload: { email: string; password: string }) {
  return request<SessionUser>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
}

export function logout() {
  return request<{ signedOut: true }>("/api/auth/logout", { method: "POST" });
}

export function getCurrentUser() {
  return request<UserRecord>("/api/auth/me");
}

export function updateProfile(payload: { name?: string; phone?: string | null; organization?: string | null; department?: string | null }) {
  return request<UserRecord>("/api/auth/profile", { method: "PATCH", body: JSON.stringify(payload) });
}

export function changePassword(payload: { currentPassword: string; newPassword: string }) {
  return request<{ updated: true }>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ── Admin: audit log + comparison management ──
export function deleteAuditEntry(id: string) {
  return request<{ id: string }>(`/api/audit/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function clearAuditLog() {
  return request<{ deletedCount: number }>("/api/audit", { method: "DELETE" });
}

export function deleteComparison(id: string) {
  return request<{ id: string; deletedDocuments: number }>(
    `/api/comparison/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

// [ADMIN-APPROVAL] Delete this block to retire the admin-approval feature.
export interface PendingUserDto {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export function getPendingUsers() {
  return request<{ pending: PendingUserDto[] }>("/api/admin/users");
}

export function approveUser(id: string) {
  return request<{ id: string; approved: true }>(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "POST",
  });
}

export function rejectUser(id: string) {
  return request<{ id: string; rejected: true }>(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
// [ADMIN-APPROVAL] End of block.
