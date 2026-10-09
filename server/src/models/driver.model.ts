import { Schema, model, Document } from "mongoose";

export interface IDriver extends Document {
  ownerId?: Schema.Types.ObjectId | string;
  id: string; // DRV-101
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  plate: string;
  colour?: string;
  seats: number;
  luggage: number;
  rating: number;
  trips: number;
  commission: number;
  perKm: number;
  minimum: number;
  etaPad: number;
  status: "Active" | "On a trip" | "Invited" | "Paused";
  coverage: string;
  note?: string;
  languages?: string;
  joined: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DriverSchema = new Schema<IDriver>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    vehicle: { type: String, required: true },
    plate: { type: String, required: true },
    colour: { type: String, default: "White" },
    seats: { type: Number, default: 4 },
    luggage: { type: Number, default: 3 },
    rating: { type: Number, default: 5.0 },
    trips: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
    perKm: { type: Number, default: 55 },
    minimum: { type: Number, default: 300 },
    etaPad: { type: Number, default: 15 },
    status: {
      type: String,
      enum: ["Active", "On a trip", "Invited", "Paused"],
      default: "Invited",
      index: true,
    },
    coverage: { type: String, default: "Darjeeling • Hill Roads" },
    note: { type: String, default: "" },
    languages: { type: String, default: "Nepali, Hindi, English" },
    joined: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

export const Driver = model<IDriver>("Driver", DriverSchema);
