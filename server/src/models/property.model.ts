import { Schema, model, Document } from "mongoose";

export interface IEstateLocation {
  id: string;
  name: string;
  address: string;
  kind: string;
  units: number;
  note: string;
  lat: number | null;
  lng: number | null;
}

export interface IProperty extends Document {
  ownerId?: Schema.Types.ObjectId | string;
  slug?: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  address: string;
  town: string;
  region: string;
  postal: string;
  bio: string;
  checkInTime: string;
  checkOutTime: string;
  responseTime: string;
  currency: string;
  status: "active" | "pending" | "paused";
  commissionRate: number;
  icalFeeds?: {
    airbnbUrl?: string;
    bookingUrl?: string;
    lastSyncedAt?: Date;
  };
  locations: IEstateLocation[];
  createdAt: Date;
  updatedAt: Date;
}

const LocationSchema = new Schema<IEstateLocation>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    address: { type: String, required: true },
    kind: { type: String, required: true },
    units: { type: Number, default: 1 },
    note: { type: String, default: "" },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  { _id: false }
);

const PropertySchema = new Schema<IProperty>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    slug: { type: String, lowercase: true, trim: true, index: true },
    name: { type: String, required: true },
    role: { type: String, default: "Estate Owner & Host" },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    town: { type: String, default: "Darjeeling" },
    region: { type: String, default: "West Bengal" },
    postal: { type: String, default: "734101" },
    bio: { type: String, default: "" },
    checkInTime: { type: String, default: "3:00 PM" },
    checkOutTime: { type: String, default: "11:00 AM" },
    responseTime: { type: String, default: "Usually within 20 minutes" },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["active", "pending", "paused"],
      default: "active",
      index: true,
    },
    commissionRate: { type: Number, default: 0.18 },
    icalFeeds: {
      airbnbUrl: { type: String, default: "" },
      bookingUrl: { type: String, default: "" },
      lastSyncedAt: { type: Date },
    },
    locations: { type: [LocationSchema], default: [] },
  },
  { timestamps: true }
);

export const Property = model<IProperty>("Property", PropertySchema);
