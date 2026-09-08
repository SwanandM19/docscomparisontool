import { Schema, model, models, type Model, type Document as MongooseDocument } from "mongoose";
import type { AssistantMessage } from "@/types/assistant";

export interface AssistantConversationDoc extends MongooseDocument {
  // One rolling conversation per user, keyed by email (matches how the rest
  // of the app scopes user-owned records).
  ownerEmail: string;
  messages: AssistantMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const AssistantMessageSchema = new Schema<AssistantMessage>(
  {
    id: { type: String, required: true },
    sender: { type: String, enum: ["user", "ai"], required: true },
    text: { type: String, required: true },
    timestamp: { type: String, required: true },
  },
  { _id: false }
);

const AssistantConversationSchema = new Schema<AssistantConversationDoc>(
  {
    ownerEmail: { type: String, required: true, unique: true, index: true },
    messages: { type: [AssistantMessageSchema], default: [] },
  },
  { timestamps: true }
);

export const AssistantConversationModel: Model<AssistantConversationDoc> =
  (models.AssistantConversation as Model<AssistantConversationDoc>) ||
  model<AssistantConversationDoc>("AssistantConversation", AssistantConversationSchema);

export default AssistantConversationModel;
