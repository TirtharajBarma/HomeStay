import mongoose, { Schema } from "mongoose";
import { tenantDbModel } from "../utils/tenant-model.js";

// Calendar sync for one room of one homestay: its export link (for Airbnb/Booking.com to read our
// bookings) and the OTA calendar links we import. Kept outside the tenant blob so the scheduled sync
// can find every room with feeds without loading every homestay.
const ImportSchema = new Schema(
  {
    id: { type: String, required: true },
    url: { type: String, required: true },
    source: { type: String, default: "" }, // e.g. "Airbnb"
    lastSyncAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
    eventCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const IcalFeedSchema = new Schema(
  {
    tenantKey: { type: String, required: true, index: true },
    roomId: { type: Number, required: true },
    exportToken: { type: String, required: true, unique: true }, // capability URL: only reveals busy dates
    imports: { type: [ImportSchema], default: [] },
  },
  { timestamps: true }
);
IcalFeedSchema.index({ tenantKey: 1, roomId: 1 }, { unique: true });

export function getIcalFeedModel(isDemo = false): mongoose.Model<any> {
  return tenantDbModel(isDemo, "IcalFeed", IcalFeedSchema) as mongoose.Model<any>;
}
