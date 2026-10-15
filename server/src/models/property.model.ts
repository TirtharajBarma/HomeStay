import { Schema, model, Document } from "mongoose";
import { getISTTimestamp } from "../utils/date.js";

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
  platformFeePercent?: number | null;
  homestayCommissionPercent?: number | null;
  coordinates?: {
    latitude: number | null;
    longitude: number | null;
  };
  featureAccess?: {
    campaigns: boolean;
    networkDispatch: boolean;
    guestCabLinks: boolean;
  };
  icalFeeds?: {
    airbnbUrl?: string;
    bookingUrl?: string;
    lastSyncedAt?: Date;
  };
  locations: IEstateLocation[];
  createdAt: Date;
  updatedAt: Date;
  createdAtIST?: string;
  updatedAtIST?: string;
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
    platformFeePercent: { type: Number, default: null },
    homestayCommissionPercent: { type: Number, default: null },
    coordinates: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    featureAccess: {
      campaigns: { type: Boolean, default: true },
      networkDispatch: { type: Boolean, default: true },
      guestCabLinks: { type: Boolean, default: true },
    },
    icalFeeds: {
      airbnbUrl: { type: String, default: "" },
      bookingUrl: { type: String, default: "" },
      lastSyncedAt: { type: Date },
    },
    locations: { type: [LocationSchema], default: [] },
    createdAtIST: { type: String, default: () => getISTTimestamp() },
    updatedAtIST: { type: String, default: () => getISTTimestamp() },
  },
  { timestamps: true }
);

PropertySchema.pre("save", function () {
  this.updatedAtIST = getISTTimestamp();
  if (!this.createdAtIST) {
    this.createdAtIST = getISTTimestamp();
  }
});

export const Property = model<IProperty>("Property", PropertySchema);
