import mongoose, { Schema, Document } from "mongoose";

export type CollaborationStatus =
  | "NEW"
  | "PENDING"
  | "CONTACTED"
  | "FINDING INFLUENCERS"
  | "IN_NEGOTIATION"
  | "PROPOSAL SENT"
  | "CONFIRMED"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

export type CollaborationRequestType =
  | "INFLUENCER_COLLABORATION"
  | "BUDGET_BASED_PROMOTION";

export interface ICollaborationRequest extends Document {
  requestId: string;
  requestType: CollaborationRequestType;
  budget?: number;
  preferredDestination?: string;
  promotionRequirements?: string;
  additionalMessage?: string;
  assignedInfluencerId?: mongoose.Types.ObjectId;
  assignedInfluencerName?: string;
  agreedPrice?: number;
  influencerId?: mongoose.Types.ObjectId;
  influencerName?: string;
  influencerHandle?: string;
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
    requestId: {
      type: String,
      default: () => "REQ-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(100 + Math.random() * 900),
      unique: true,
      sparse: true,
      index: true,
    },
    requestType: {
      type: String,
      enum: ["INFLUENCER_COLLABORATION", "BUDGET_BASED_PROMOTION"],
      default: "INFLUENCER_COLLABORATION",
      index: true,
    },
    budget: { type: Number, default: 0 },
    preferredDestination: { type: String, default: "", trim: true },
    promotionRequirements: { type: String, default: "", trim: true },
    additionalMessage: { type: String, default: "", trim: true },
    assignedInfluencerId: { type: Schema.Types.ObjectId, ref: "Influencer" },
    assignedInfluencerName: { type: String, default: "", trim: true },
    agreedPrice: { type: Number },
    influencerId: {
      type: Schema.Types.ObjectId,
      ref: "Influencer",
      required: false,
      index: true,
    },
    influencerName: { type: String, default: "", trim: true },
    influencerHandle: { type: String, default: "", trim: true },
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
      enum: [
        "NEW",
        "PENDING",
        "CONTACTED",
        "FINDING INFLUENCERS",
        "IN_NEGOTIATION",
        "PROPOSAL SENT",
        "CONFIRMED",
        "COMPLETED",
        "REJECTED",
        "CANCELLED",
      ],
      default: "NEW",
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
CollaborationRequestSchema.index({ requestType: 1, createdAt: -1 });
CollaborationRequestSchema.index({ status: 1, createdAt: -1 });

export const CollaborationRequest =
  (mongoose.models.CollaborationRequest as mongoose.Model<ICollaborationRequest>) ||
  mongoose.model<ICollaborationRequest>("CollaborationRequest", CollaborationRequestSchema);
