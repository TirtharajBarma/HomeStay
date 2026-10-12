import { Schema, model, Document } from "mongoose";

export interface ICabTrip extends Document {
  reference: string; // CAB-1234
  driverId: string;
  driverName: string;
  vehicle: string;
  plate: string;
  guestName: string;
  email: string;
  phone: string;
  pickupName: string;
  pickupLat: number;
  pickupLng: number;
  dropoffName: string;
  dropoffLat: number;
  dropoffLng: number;
  pickupDate: string;
  pickupTime: string;
  ownerId?: Schema.Types.ObjectId | string;
  propertyId?: Schema.Types.ObjectId | string;
  seats: number;
  distanceKm: number;
  fareAmount: number;
  commissionRate: number; // 0.18
  estateCommission: number; // 18% cut
  driverPayout: number; // 82% cut
  payoutStatus: "pending" | "settled";
  settlementReference?: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

const CabTripSchema = new Schema<ICabTrip>(
  {
    reference: { type: String, required: true, unique: true, index: true },
    driverId: { type: String, required: true, index: true },
    driverName: { type: String, required: true },
    vehicle: { type: String, required: true },
    plate: { type: String, required: true },
    guestName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    pickupName: { type: String, required: true },
    pickupLat: { type: Number, required: true },
    pickupLng: { type: Number, required: true },
    dropoffName: { type: String, required: true },
    dropoffLat: { type: Number, required: true },
    dropoffLng: { type: Number, required: true },
    pickupDate: { type: String, required: true },
    pickupTime: { type: String, required: true },
    seats: { type: Number, required: true },
    distanceKm: { type: Number, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", index: true },
    fareAmount: { type: Number, required: true },
    commissionRate: { type: Number, default: 0.18 },
    estateCommission: { type: Number, required: true },
    driverPayout: { type: Number, required: true },
    payoutStatus: {
      type: String,
      enum: ["pending", "settled"],
      default: "pending",
      index: true,
    },
    settlementReference: { type: String, default: "" },
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "cancelled"],
      default: "scheduled",
      index: true,
    },
  },
  { timestamps: true }
);

export const CabTrip = model<ICabTrip>("CabTrip", CabTripSchema);
