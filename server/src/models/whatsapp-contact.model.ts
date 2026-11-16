import mongoose, { Schema, Document, Types } from "mongoose";
import { tenantDbModel } from "../utils/tenant-model.js";

export interface IWhatsappContact extends Document {
  phoneNumber: string;
  customerName: string;
  guestId?: Types.ObjectId | string | null;
  profileImage?: string | null;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export const WhatsappContactSchema = new Schema<IWhatsappContact>(
  {
    phoneNumber: { type: String, required: true, index: true },
    customerName: { type: String, default: "" },
    guestId: { type: Schema.Types.Mixed, default: null, index: true },
    profileImage: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    collection: "whatsapp_contacts",
  }
);

export function getWhatsappContactModel(isDemo = false): mongoose.Model<IWhatsappContact> {
  return tenantDbModel<IWhatsappContact>(isDemo, "WhatsappContact", WhatsappContactSchema);
}

export const WhatsappContact =
  mongoose.models.WhatsappContact ||
  mongoose.model<IWhatsappContact>("WhatsappContact", WhatsappContactSchema);
