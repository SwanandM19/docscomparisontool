import { z } from "zod";

export const documentKindSchema = z.enum(["PO", "GRN", "Invoice", "Contract"]);

export const uploadRequestSchema = z.object({
  kind: documentKindSchema,
  fileUrl: z.string().url(),
  fileName: z.string().min(1),
  fileSize: z.number().positive(),
  mimeType: z.string().min(1),
});

export const extractRequestSchema = z.object({
  documentId: z.string().min(1, "documentId is required"),
});

export const toleranceRuleSchema = z.object({
  id: z.string().optional(),
  field: z.string().min(1),
  type: z.enum(["percentage", "absolute"]),
  value: z.number(),
  unit: z.string().min(1),
  enabled: z.boolean(),
  category: z.enum(["pricing", "quantity", "dates", "general"]),
  description: z.string().optional(),
});

export const compareRequestSchema = z.object({
  mode: z.enum(["2-way", "3-way", "universal", "contract"]),
  documentIds: z.array(z.string().min(1)).min(2).max(3),
  presetUsed: z.string().min(1),
  toleranceRules: z.array(toleranceRuleSchema).optional(),
});

export const summaryRequestSchema = z.object({
  comparisonId: z.string().min(1),
});

export const recommendationRequestSchema = z.object({
  comparisonId: z.string().min(1),
});

export const chatRequestSchema = z.object({
  comparisonId: z.string().min(1),
  message: z.string().min(1).max(2000),
});

export const exportRequestSchema = z.object({
  comparisonId: z.string().min(1),
});

// Shared minimum bar for any new/changed password: 8+ characters plus at
// least one letter and one number. Mirrors the client-side checklist in
// lib/validators.ts — keep the two in sync.
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const signupRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(120)
    .regex(/[A-Za-z]/, "Name must contain at least one letter"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  password: passwordSchema,
});

export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  organization: z.string().trim().max(160).nullable().optional(),
  department: z.string().trim().max(160).nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const toleranceUpdateSchema = z.object({
  rules: z.array(toleranceRuleSchema).min(1),
});

export const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["Matched", "Partial", "Failed"]).optional(),
});
