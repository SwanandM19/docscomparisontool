import { Schema, model, models, type Model, type Document as MongooseDocument } from "mongoose";
import type { UserRole } from "@/types/user";

export interface UserDoc extends MongooseDocument {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  department: string | null;
  organization: string | null;
  phone: string | null;
  // [ADMIN-APPROVAL] Remove this field to fully retire the approval-gate feature.
  approved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ["admin", "user"], default: "user", index: true },
    department: { type: String, default: null },
    organization: { type: String, default: null },
    phone: { type: String, default: null },
    // [ADMIN-APPROVAL] Remove this field to fully retire the approval-gate feature.
    approved: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const UserModel: Model<UserDoc> =
  (models.User as Model<UserDoc>) || model<UserDoc>("User", UserSchema);

export default UserModel;
