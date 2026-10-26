import mongoose, { Schema, model, Document } from "mongoose";
import { getISTTimestamp } from "../utils/date.js";
import { dbNameFor } from "../config/env.js";

export interface IPropertyCommissionOverride {
  propertyId: Schema.Types.ObjectId | string;
  propertyName?: string;
  platformFeePercent: number; // e.g. 5.0
  homestayCommissionPercent: number; // e.g. 10.0
  notes?: string;
}

export interface ICommissionSettings extends Document {
  totalCommissionPercent: number; // e.g. 10.0 (10% total commission agreed with drivers)
  adminSharePercentOfCommission: number; // e.g. 50.0 (50% of total commission to StayRide)
  homestaySharePercentOfCommission: number; // e.g. 50.0 (50% of total commission to Homestay)
  globalPlatformFeePercent: number; // e.g. 5.0 (5%) - derived or backward compatible
  globalHomestayCommissionPercent: number; // e.g. 5.0 (5%) - derived or backward compatible
  defaultAdvancePercent: number; // e.g. 15.0 or 20.0% of fare
  minAdvanceAmount: number; // e.g. 500 floor
  quoteWindowHours?: number; // e.g. 4.0 hours waiting window for driver quotes
  minDriverPayoutThreshold?: number; // e.g. 100 INR minimum balance to request payout
  ownFleetCommissionPercent?: number; // e.g. 0% for homestay's own fleet (0-100)
  ownFleetMinFee?: number; // minimum platform fee for homestay's own fleet
  propertyOverrides: IPropertyCommissionOverride[];
  // Platform-wide feature switches: enabled=false disables everywhere (wins over per-homestay overrides);
  // defaultOn decides the per-homestay value when admin hasn't overridden it.
  features: Record<string, { enabled: boolean; defaultOn: boolean }>;
  // Operational settings (times, presets, vehicles, limits, fees...); see services/platform-config.ts
  platform?: Record<string, any>;
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
    totalCommissionPercent: {
      type: Number,
      required: true,
      default: 10.0, // Default 10% total commission
      min: 0,
      max: 100,
    },
    adminSharePercentOfCommission: {
      type: Number,
      required: true,
      default: 50.0, // 50% of commission goes to StayRide
      min: 0,
      max: 100,
    },
    homestaySharePercentOfCommission: {
      type: Number,
      required: true,
      default: 50.0, // 50% of commission goes to Homestay
      min: 0,
      max: 100,
    },
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
      default: 5.0, // Default 5% homestay host referral commission
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
    minAdvanceAmount: { type: Number, default: 500, min: 0 },
    quoteWindowHours: { type: Number, min: 0.1, max: 72 },
    minDriverPayoutThreshold: { type: Number, min: 0 },
    ownFleetCommissionPercent: { type: Number, min: 0, max: 100 },
    ownFleetMinFee: { type: Number, min: 0 },
    features: { type: Schema.Types.Mixed, default: () => ({}) },
    platform: { type: Schema.Types.Mixed, default: () => ({}) },
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

  // Ensure totalCommissionPercent is partitioned consistently
  if (this.totalCommissionPercent !== undefined) {
    const adminShare = this.adminSharePercentOfCommission ?? 50;
    this.globalPlatformFeePercent = Number(((this.totalCommissionPercent * adminShare) / 100).toFixed(2));
    this.globalHomestayCommissionPercent = Number((this.totalCommissionPercent - this.globalPlatformFeePercent).toFixed(2));
    this.homestaySharePercentOfCommission = Number((100 - adminShare).toFixed(2));
  }

  // Safety guard: Advance must cover Total Commission to prevent negative driver debt
  const totalComm = this.totalCommissionPercent ?? (this.globalPlatformFeePercent + this.globalHomestayCommissionPercent);
  if (this.defaultAdvancePercent < totalComm) {
    throw new Error(
      `Invalid commission configuration: Default Advance (${this.defaultAdvancePercent}%) cannot be lower than Total Commission (${totalComm}%). Advance must be greater than or equal to total commission to prevent negative driver balances.`
    );
  }
});

export const CommissionSettings = model<ICommissionSettings>(
  "CommissionSettings",
  CommissionSettingsSchema
);

// Platform settings live in the "production" db ("test" for the demo tenant), never the default connection.
export function getCommissionSettingsModel(isDemo = false): mongoose.Model<ICommissionSettings> {
  const conn = mongoose.connection.useDb(dbNameFor(isDemo), { useCache: true });
  return (conn.models.CommissionSettings ||
    conn.model<ICommissionSettings>("CommissionSettings", CommissionSettingsSchema)) as mongoose.Model<ICommissionSettings>;
}
