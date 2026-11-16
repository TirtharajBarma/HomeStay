import mongoose, { Schema } from "mongoose";
import { tenantDbModel } from "../utils/tenant-model.js";

// Short-lived per-driver assignment locks. Two confirmations for the same driver are a
// check-then-write across two CabRequest documents, so a lock document makes that window exclusive.
// `expiresAt` holds a TTL index: a crashed instance never leaves a driver locked forever.
const DriverLockSchema = new Schema({
  key: { type: String, required: true, unique: true },
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export function getDriverLockModel(isDemo = false): mongoose.Model<any> {
  return tenantDbModel(isDemo, "DriverLock", DriverLockSchema) as mongoose.Model<any>;
}
