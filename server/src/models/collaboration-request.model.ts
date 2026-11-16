import mongoose, { Schema, Document } from "mongoose";

export type CollaborationStatus =
  | "PENDING"
  | "CONTACTED"
  | "IN_NEGOTIATION"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED";

export interface ICollaborationRequest extends Document {
  influencerId: mongoose.Types.ObjectId;
  influencerName: string;
  influencerHandle: string;
  influencerPhoto?: string;
  ownerId?: string;
  tenantKey?: string;
  homestayId?: string;
  homestayName: string;
  homestayLocation?: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string;
  selectedPackage?: {
    name: string;
    price: number;
    deliverables?: string;
  };
  customRequirements?: string;
  proposedDates?: string;
  status: CollaborationStatus;
  negotiatedPrice?: number;
  confirmedShootingDate?: string;
  deliveredPostUrl?: string;
  adminNotes?: string;
  statusHistory: Array<{
    status: CollaborationStatus;
    updatedAt: Date;
    note?: string;
    updatedBy?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const CollaborationRequestSchema = new Schema<ICollaborationRequest>(
  {
    influencerId: {
      type: Schema.Types.ObjectId,
      ref: "Influencer",
      required: true,
      index: true,
    },
    influencerName: { type: String, required: true, trim: true },
    influencerHandle: { type: String, required: true, trim: true },
    influencerPhoto: { type: String, default: "" },
    ownerId: { type: String, default: "", index: true },
    tenantKey: { type: String, default: "", index: true },
    homestayId: { type: String, default: "", index: true },
    homestayName: { type: String, required: true, trim: true },
    homestayLocation: { type: String, default: "", trim: true },
    ownerName: { type: String, required: true, trim: true },
    ownerPhone: { type: String, required: true, trim: true, index: true },
    ownerEmail: { type: String, default: "", trim: true },
    selectedPackage: {
      name: { type: String, default: "" },
      price: { type: Number, default: 0 },
      deliverables: { type: String, default: "" },
    },
    customRequirements: { type: String, default: "", trim: true },
    proposedDates: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["PENDING", "CONTACTED", "IN_NEGOTIATION", "CONFIRMED", "COMPLETED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    negotiatedPrice: { type: Number },
    confirmedShootingDate: { type: String, default: "" },
    deliveredPostUrl: { type: String, default: "" },
    adminNotes: { type: String, default: "", trim: true },
    statusHistory: [
      {
        status: { type: String, required: true },
        updatedAt: { type: Date, default: Date.now },
        note: { type: String, default: "" },
        updatedBy: { type: String, default: "admin" },
      },
    ],
  },
  { timestamps: true }
);

CollaborationRequestSchema.index({ createdAt: -1 });
CollaborationRequestSchema.index({ status: 1, createdAt: -1 });

export const CollaborationRequest =
  (mongoose.models.CollaborationRequest as mongoose.Model<ICollaborationRequest>) ||
  mongoose.model<ICollaborationRequest>("CollaborationRequest", CollaborationRequestSchema);
