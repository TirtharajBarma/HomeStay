import mongoose, { Schema } from "mongoose";
import { tenantDbModel } from "../utils/tenant-model.js";

// Secure guest "Ask for Cab" link. Only the sha256 of the token is stored.
const GuestLinkSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    tenantKey: { type: String, required: true, index: true },
    guestId: { type: Number, default: null },
    guestName: { type: String, default: "" },
    guestPhone: { type: String, default: "" },
    // Set when StayRide WhatsApped this link to the guest (Ask-for-Cab); drives the per-guest cooldown
    sentAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // Mongo TTL cleans up expired links
  },
  { timestamps: true }
);

export function getGuestLinkModel(isDemo = false): mongoose.Model<any> {
  // Guest links are tenant data: demo links only in "test", the rest only in "production". The old
  // fallback used the default connection (production) when the DB was not ready.
  return tenantDbModel(isDemo, "GuestLink", GuestLinkSchema) as mongoose.Model<any>;
}
