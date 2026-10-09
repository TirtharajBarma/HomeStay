import { Schema, model, Document, Types } from "mongoose";

export interface IBooking extends Document {
  reference: string;
  pin: string;
  ownerId?: Types.ObjectId | string;
  propertyId?: Types.ObjectId | string;
  homestayName?: string;
  roomId?: Types.ObjectId;
  roomCode: string;
  roomName: string;
  staySlug: string;
  guestName: string;
  email: string;
  phone: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  party: number;
  arrivalWindow: string;
  breakfasts: string[];
  channel: string;
  status: "confirmed" | "checked_in" | "checked_out" | "cancelled";
  plan: "card_full" | "deposit";
  settled: boolean;
  nightlyRate: number;
  roomTotal: number;
  cleaningFee: number;
  taxAmount: number;
  totalAmount: number;
  dueToday: number;
  balanceDue: number;
  cancellationBy: string;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    reference: { type: String, required: true, unique: true, index: true },
    pin: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", index: true },
    homestayName: { type: String, default: "" },
    roomId: { type: Schema.Types.ObjectId, ref: "Room" },
    roomCode: { type: String, required: true, index: true },
    roomName: { type: String, required: true },
    staySlug: { type: String, required: true, index: true },
    guestName: { type: String, required: true },
    email: { type: String, required: true, index: true },
    phone: { type: String, required: true },
    checkIn: { type: String, required: true, index: true },
    checkOut: { type: String, required: true, index: true },
    nights: { type: Number, required: true },
    party: { type: Number, default: 1 },
    arrivalWindow: { type: String, default: "2:00 PM – 4:00 PM" },
    breakfasts: { type: [String], default: [] },
    channel: {
      type: String,
      default: "direct",
      index: true,
    },
    status: {
      type: String,
      enum: ["confirmed", "checked_in", "checked_out", "cancelled"],
      default: "confirmed",
      index: true,
    },
    plan: {
      type: String,
      enum: ["card_full", "deposit"],
      default: "card_full",
    },
    settled: { type: Boolean, default: true },
    nightlyRate: { type: Number, required: true },
    roomTotal: { type: Number, required: true },
    cleaningFee: { type: Number, default: 900 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    dueToday: { type: Number, required: true },
    balanceDue: { type: Number, default: 0 },
    cancellationBy: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Booking = model<IBooking>("Booking", BookingSchema);
