import mongoose, { Schema } from "mongoose";
import { dbNameFor } from "../config/env.js";

// Admin-only controls per StayRide homestay (tenant). Owners can never write this collection.
export const FEATURE_KEYS = ["campaigns", "guestCabLinks", "platformDispatch", "payouts", "driverQuotes"] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

const TenantControlSchema = new Schema(
  {
    tenantKey: { type: String, required: true, unique: true },
    blocked: { type: Boolean, default: false },
    blockReason: { type: String, default: "" },
    // null = follow the platform default; true/false = admin override (a global disable still wins)
    features: { type: Schema.Types.Mixed, default: {} },
    commissionOverride: {
      type: new Schema(
        { pfPercent: Number, hcPercent: Number, advancePercent: Number },
        { _id: false }
      ),
      default: null,
    },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export function getTenantControlModel(isDemo = false): mongoose.Model<any> {
  const conn = mongoose.connection.useDb(dbNameFor(isDemo), { useCache: true });
  return (conn.models.TenantControl || conn.model("TenantControl", TenantControlSchema)) as mongoose.Model<any>;
}
