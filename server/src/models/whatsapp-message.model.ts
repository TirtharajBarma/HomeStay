import mongoose, { Schema, Document, Types } from "mongoose";
import { tenantDbModel } from "../utils/tenant-model.js";

export type WhatsappDirection = "INBOUND" | "OUTBOUND";
export type WhatsappSenderType = "CUSTOMER" | "ADMIN" | "SYSTEM";
export type WhatsappMessageType = "TEXT" | "IMAGE" | "DOCUMENT" | "TEMPLATE" | "OTHER";
export type WhatsappDeliveryStatus = "SENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";

export interface IWhatsappMessage extends Document {
  conversationId: Types.ObjectId | any;
  contactId?: Types.ObjectId | any;
  whatsappMessageId?: string | null;
  direction: WhatsappDirection;
  senderType: WhatsappSenderType;
  messageType: WhatsappMessageType;
  messageContent: string;
  templateName?: string | null;
  templateLanguage?: string | null;
  templateParameters?: string[] | Record<string, any> | null;
  mediaId?: string | null;
  mediaUrl?: string | null;
  deliveryStatus: WhatsappDeliveryStatus;
  sentAt: Date;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  errorDetails?: string | null;
  adminId?: Types.ObjectId | string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const WhatsappMessageSchema = new Schema<IWhatsappMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "WhatsappConversation", required: true, index: true },
    contactId: { type: Schema.Types.ObjectId, ref: "WhatsappContact", index: true },
    whatsappMessageId: {
      type: String,
      default: null,
      index: { unique: true, sparse: true },
    },
    direction: {
      type: String,
      enum: ["INBOUND", "OUTBOUND"],
      required: true,
      index: true,
    },
    senderType: {
      type: String,
      enum: ["CUSTOMER", "ADMIN", "SYSTEM"],
      required: true,
      index: true,
    },
    messageType: {
      type: String,
      enum: ["TEXT", "IMAGE", "DOCUMENT", "TEMPLATE", "OTHER"],
      default: "TEXT",
    },
    messageContent: { type: String, required: true },
    templateName: { type: String, default: null },
    templateLanguage: { type: String, default: null },
    templateParameters: { type: Schema.Types.Mixed, default: null },
    mediaId: { type: String, default: null },
    mediaUrl: { type: String, default: null },
    deliveryStatus: {
      type: String,
      enum: ["SENDING", "SENT", "DELIVERED", "READ", "FAILED"],
      default: "SENT",
      index: true,
    },
    sentAt: { type: Date, default: Date.now, index: 1 },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    errorDetails: { type: String, default: null },
    adminId: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: true,
    collection: "whatsapp_messages",
  }
);

WhatsappMessageSchema.index({ conversationId: 1, sentAt: 1 });
WhatsappMessageSchema.index({ conversationId: 1, createdAt: 1 });

export function getWhatsappMessageModel(isDemo = false): mongoose.Model<IWhatsappMessage> {
  return tenantDbModel<IWhatsappMessage>(isDemo, "WhatsappMessage", WhatsappMessageSchema);
}

export const WhatsappMessage =
  mongoose.models.WhatsappMessage ||
  mongoose.model<IWhatsappMessage>("WhatsappMessage", WhatsappMessageSchema);
