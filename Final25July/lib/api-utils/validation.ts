import { z } from "zod";
import { isTranslationDirection, type TranslationDirection } from "@/types/translation";

/** Any "source-target" pair from the supported language set, source !== target. */
const translationDirectionSchema = z
  .string()
  .refine(isTranslationDirection, { message: "Unsupported or invalid translation direction." })
  .transform((v) => v as TranslationDirection);

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

export const intelligentCompareRequestSchema = z.object({
  files: z
    .array(
      z.object({
        fileUrl: z.string().url(),
        fileName: z.string().min(1),
        fileSize: z.number().positive(),
        mimeType: z.string().min(1),
      })
    )
    .min(2, "Provide at least 2 documents to compare")
    .max(5, "You can compare up to 5 documents at once"),
});

const uploadedFileSchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().min(1),
  fileSize: z.number().positive(),
  mimeType: z.string().min(1),
});

export const summarizeRequestSchema = z.object({
  files: z
    .array(uploadedFileSchema)
    .min(1, "Upload at least one document to summarize")
    .max(5, "You can summarize up to 5 documents at once"),
});

const summaryLabelledValueSchema = z.object({
  label: z.string().max(200).default(""),
  value: z.string().max(4000).default(""),
});

const documentSummarySchema = z.object({
  fileName: z.string().max(260).default("Document"),
  documentType: z.string().max(120).default("Document"),
  title: z.string().max(300).default("Document"),
  overview: z.string().max(8000).default(""),
  parties: z
    .array(
      z.object({
        role: z.string().max(120).default(""),
        name: z.string().max(300).default(""),
        details: z.string().max(2000).default(""),
      })
    )
    .max(20)
    .default([]),
  keyFields: z.array(summaryLabelledValueSchema).max(80).default([]),
  dates: z.array(summaryLabelledValueSchema).max(40).default([]),
  financials: z.array(summaryLabelledValueSchema).max(60).default([]),
  lineItems: z
    .array(
      z.object({
        description: z.string().max(600).default(""),
        quantity: z.string().max(60).default(""),
        unitPrice: z.string().max(60).default(""),
        amount: z.string().max(60).default(""),
      })
    )
    .max(200)
    .default([]),
  highlights: z.array(z.string().max(1000)).max(40).default([]),
});

export const summaryPdfSchema = z.object({
  documents: z.array(documentSummarySchema).min(1).max(5),
});

export const documentFieldsRequestSchema = z.object({
  file: uploadedFileSchema,
});

const fieldValueInputSchema = z.object({
  id: z.string().min(1),
  label: z.string().max(300).default(""),
  value: z.string().max(2000).default(""),
});

export const invoiceFillRequestSchema = z.object({
  file: uploadedFileSchema,
  fields: z.array(fieldValueInputSchema).max(500).default([]),
  notes: z.string().trim().max(2000).default(""),
});

export const documentFillPdfSchema = z.object({
  documentType: z.string().trim().min(1).max(200).default("Document"),
  content: z.string().min(1).max(200_000),
});

export const translateRequestSchema = z.object({
  direction: translationDirectionSchema,
  file: z.object({
    fileUrl: z.string().url(),
    fileName: z.string().min(1),
    fileSize: z.number().positive(),
    mimeType: z.string().min(1),
  }),
});

export const translationPdfSchema = z.object({
  fileName: z.string().trim().min(1).max(260),
  direction: translationDirectionSchema,
  sourceText: z.string().max(200_000).default(""),
  translatedText: z.string().min(1).max(200_000),
  confidence: z.number().min(0).max(1).default(0),
});

export const invoicePartySchema = z.object({
  name: z.string().trim().max(200).default(""),
  address: z.string().trim().max(600).default(""),
  gstin: z.string().trim().max(30).default(""),
  email: z.string().trim().max(254).default(""),
  phone: z.string().trim().max(40).default(""),
});

export const invoiceLineItemSchema = z.object({
  id: z.string().min(1),
  description: z.string().trim().max(500).default(""),
  hsn: z.string().trim().max(20).default(""),
  quantity: z.number().min(0).max(1_000_000),
  unitPrice: z.number().min(0).max(1_000_000_000),
  taxRate: z.number().min(0).max(100),
});

export const invoiceDataSchema = z.object({
  invoiceNumber: z.string().trim().min(1, "Invoice number is required").max(60),
  invoiceDate: z.string().trim().max(30).default(""),
  dueDate: z.string().trim().max(30).default(""),
  currency: z.string().trim().min(1).max(5).default("INR"),
  taxMode: z.enum(["cgst_sgst", "igst", "none"]).default("cgst_sgst"),
  seller: invoicePartySchema,
  buyer: invoicePartySchema,
  lineItems: z
    .array(invoiceLineItemSchema)
    .min(1, "Add at least one line item")
    .max(100, "An invoice can hold up to 100 line items"),
  discount: z.number().min(0).default(0),
  shipping: z.number().min(0).default(0),
  notes: z.string().trim().max(2000).default(""),
  terms: z.string().trim().max(2000).default(""),
});

export const invoiceSaveSchema = z.object({
  data: invoiceDataSchema,
  status: z.enum(["draft", "final"]).default("draft"),
});

export const invoicePdfSchema = z.object({
  data: invoiceDataSchema,
});

export const recommendationRequestSchema = z.object({
  comparisonId: z.string().min(1),
});

export const chatRequestSchema = z.object({
  comparisonId: z.string().min(1),
  message: z.string().min(1).max(2000),
});

export const assistantChatSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(2000),
  /** Which dashboard screen the user is currently on, so the assistant can
   *  tailor its answer to that section. Free-form id from the sidebar. */
  section: z.string().trim().max(40).optional(),
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
