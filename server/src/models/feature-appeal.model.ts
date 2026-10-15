import { Schema, model, Document } from "mongoose";
import { getISTTimestamp } from "../utils/date.js";

export type FeatureKey =
  | "campaigns"
  | "whatsappCampaigns"
  | "networkDispatch"
  | "myDrivers"
  | "guestCabRequests"
  | "commissionAnalytics";

export interface IFeatureAppeal extends Document {
  propertyId: Schema.Types.ObjectId | string;
  homestayName: string;
  ownerEmail: string;
  featureKey: FeatureKey;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  decisionNote?: string;
  decidedBy?: string;
  decidedAt?: Date;
  createdAtIST?: string;
  updatedAtIST?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeatureAppealSchema = new Schema<IFeatureAppeal>(
  {
    propertyId: { type: Schema.Types.Mixed, required: true, index: true },
    homestayName: { type: String, required: true },
    ownerEmail: { type: String, required: true, index: true },
    featureKey: {
      type: String,
      enum: [
        "campaigns",
        "whatsappCampaigns",
        "networkDispatch",
        "myDrivers",
        "guestCabRequests",
        "commissionAnalytics",
      ],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    reason: { type: String, required: true },
    decisionNote: { type: String, default: "" },
    decidedBy: { type: String, default: "" },
    decidedAt: { type: Date, default: null },
    createdAtIST: { type: String, default: () => getISTTimestamp() },
    updatedAtIST: { type: String, default: () => getISTTimestamp() },
  },
  { timestamps: true }
);

FeatureAppealSchema.pre("save", function () {
  this.updatedAtIST = getISTTimestamp();
  if (!this.createdAtIST) {
    this.createdAtIST = getISTTimestamp();
  }
});

export const FeatureAppeal = model<IFeatureAppeal>("FeatureAppeal", FeatureAppealSchema);
