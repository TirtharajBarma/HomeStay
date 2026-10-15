import { Schema, model, Document } from "mongoose";
import { getISTTimestamp } from "../utils/date.js";

export interface IPropertyCommissionOverride {
  propertyId: Schema.Types.ObjectId | string;
  propertyName?: string;
  platformFeePercent: number; // e.g. 5.0
  homestayCommissionPercent: number; // e.g. 10.0
  notes?: string;
}

export interface ICommissionSettings extends Document {
  globalPlatformFeePercent: number; // e.g. 5.0 (5%)
  globalHomestayCommissionPercent: number; // e.g. 10.0 (10%)
  defaultAdvancePercent: number; // e.g. 15.0 or 20.0% of fare
  propertyOverrides: IPropertyCommissionOverride[];
  updatedBy?: string;
  changeReason?: string;
  effectiveFrom?: Date;
  createdAtIST?: string;
  updatedAtIST?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PropertyCommissionOverrideSchema = new Schema<IPropertyCommissionOverride>(
  {
    propertyId: { type: Schema.Types.Mixed, required: true }, // Property _id or StayRide tenant key
    propertyName: { type: String, default: "" },
    platformFeePercent: { type: Number, required: true, min: 0, max: 100 },
    homestayCommissionPercent: { type: Number, required: true, min: 0, max: 100 },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

const CommissionSettingsSchema = new Schema<ICommissionSettings>(
  {
    globalPlatformFeePercent: {
      type: Number,
      required: true,
      default: 5.0, // Default 5% platform fee
      min: 0,
      max: 100,
    },
    globalHomestayCommissionPercent: {
      type: Number,
      required: true,
      default: 10.0, // Default 10% homestay host referral commission
      min: 0,
      max: 100,
    },
    defaultAdvancePercent: {
      type: Number,
      required: true,
      default: 15.0, // Default 15% advance required
      min: 5,
      max: 100,
    },
    propertyOverrides: {
      type: [PropertyCommissionOverrideSchema],
      default: [],
    },
    updatedBy: { type: String, default: "system" },
    changeReason: { type: String, default: "Initial default commission settings" },
    effectiveFrom: { type: Date, default: Date.now },
    createdAtIST: { type: String, default: () => getISTTimestamp() },
    updatedAtIST: { type: String, default: () => getISTTimestamp() },
  },
  { timestamps: true }
);

CommissionSettingsSchema.pre("save", function () {
  this.updatedAtIST = getISTTimestamp();
  if (!this.createdAtIST) {
    this.createdAtIST = getISTTimestamp();
  }
});

export const CommissionSettings = model<ICommissionSettings>(
  "CommissionSettings",
  CommissionSettingsSchema
);
