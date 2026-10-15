import mongoose, { Schema } from "mongoose";

// Secure guest "Ask for Cab" link. Only the sha256 of the token is stored.
const GuestLinkSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    tenantKey: { type: String, required: true, index: true },
    guestId: { type: Number, default: null },
    guestName: { type: String, default: "" },
    guestPhone: { type: String, default: "" },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // Mongo TTL cleans up expired links
  },
  { timestamps: true }
);

export function getGuestLinkModel(isDemo = false): mongoose.Model<any> {
  const conn = mongoose.connection.readyState === 1 ? mongoose.connection.useDb(isDemo ? "test" : "production", { useCache: true }) : mongoose.connection;
  return (conn.models.GuestLink || conn.model("GuestLink", GuestLinkSchema)) as mongoose.Model<any>;
}
