import mongoose, { Schema, Document, Types } from "mongoose";
import { tenantDbModel } from "../utils/tenant-model.js";

export type WhatsappConversationStatus = "OPEN" | "CLOSED";

export interface IWhatsappConversation extends Document {
  contactId: Types.ObjectId | any;
  phoneNumber: string;
  customerName: string;
  status: WhatsappConversationStatus;
  assignedAdminId?: Types.ObjectId | string | null;
  unreadCount: number;
  lastMessage: string;
  lastMessageAt: Date;
  lastInboundMessageAt?: Date | null;
  lastMessageDirection?: "INBOUND" | "OUTBOUND";
  lastMessageStatus?: "SENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  createdAt: Date;
  updatedAt: Date;
}

export const WhatsappConversationSchema = new Schema<IWhatsappConversation>(
  {
    contactId: { type: Schema.Types.ObjectId, ref: "WhatsappContact", required: true, index: true },
    phoneNumber: { type: String, required: true, index: true },
    customerName: { type: String, default: "" },
    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      default: "OPEN",
      index: true,
    },
    assignedAdminId: { type: Schema.Types.Mixed, default: null, index: true },
    unreadCount: { type: Number, default: 0 },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now, index: -1 },
    lastInboundMessageAt: { type: Date, default: null, index: -1 },
    lastMessageDirection: { type: String, enum: ["INBOUND", "OUTBOUND"], default: "OUTBOUND" },
    lastMessageStatus: {
      type: String,
      enum: ["SENDING", "SENT", "DELIVERED", "READ", "FAILED"],
      default: "SENT",
    },
  },
  {
    timestamps: true,
    collection: "whatsapp_conversations",
  }
);

WhatsappConversationSchema.index({ status: 1, lastMessageAt: -1 });

export function getWhatsappConversationModel(isDemo = false): mongoose.Model<IWhatsappConversation> {
  return tenantDbModel<IWhatsappConversation>(isDemo, "WhatsappConversation", WhatsappConversationSchema);
}

export const WhatsappConversation =
  mongoose.models.WhatsappConversation ||
  mongoose.model<IWhatsappConversation>("WhatsappConversation", WhatsappConversationSchema);
