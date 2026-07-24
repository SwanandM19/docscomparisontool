import { Schema, model, models, type Model, type Document as MongooseDocument, Types } from "mongoose";

export type AuditStatus = "completed" | "warning" | "pending";

export interface AuditLogDoc extends MongooseDocument {
  action: string;
  documentName: string;
  user: string;
  status: AuditStatus;
  details: string;
  relatedComparisonId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<AuditLogDoc>(
  {
    action: { type: String, required: true },
    documentName: { type: String, required: true },
    user: { type: String, default: "admin@company.com" },
    status: { type: String, enum: ["completed", "warning", "pending"], default: "completed" },
    details: { type: String, default: "" },
    relatedComparisonId: { type: Schema.Types.ObjectId, ref: "Comparison", default: null },
  },
  { timestamps: true }
);

AuditLogSchema.index({ createdAt: -1 });

export const AuditLogModel: Model<AuditLogDoc> =
  (models.AuditLog as Model<AuditLogDoc>) || model<AuditLogDoc>("AuditLog", AuditLogSchema);

export default AuditLogModel;

export async function logAudit(entry: {
  action: string;
  documentName: string;
  user?: string;
  status: AuditStatus;
  details: string;
  relatedComparisonId?: string | null;
}) {
  return AuditLogModel.create({
    action: entry.action,
    documentName: entry.documentName,
    user: entry.user ?? "admin@company.com",
    status: entry.status,
    details: entry.details,
    relatedComparisonId: entry.relatedComparisonId ?? null,
  });
}
