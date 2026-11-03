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
    // Ask-for-Cab sends only (admin "Last contacted"): who sent it ("auto" | "owner" | "admin:<name>") and its
    // WhatsApp delivery status, moved forward by the status webhook. Unset on links that were never sent.
    by: { type: String },
    status: { type: String },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // Mongo TTL cleans up expired links
  },
  { timestamps: true }
);

export function getGuestLinkModel(isDemo = false): mongoose.Model<any> {
  // Guest links are tenant data: demo links only in "test", the rest only in "production". The old
  // fallback used the default connection (production) when the DB was not ready.
  return tenantDbModel(isDemo, "GuestLink", GuestLinkSchema) as mongoose.Model<any>;
}
