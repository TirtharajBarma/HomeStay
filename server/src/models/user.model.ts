import { Schema, model, Document } from "mongoose";
import bcrypt from "bcryptjs";
import { getISTTimestamp } from "../utils/date.js";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: "guest" | "owner" | "admin" | "driver";
  phone?: string;
  avatar?: string;
  clerkId?: string;
  propertyId?: Schema.Types.ObjectId | string;
  accountStatus: "ACTIVE" | "PENDING_APPROVAL" | "BLOCKED";
  statusReason?: string;
  isAvailable?: boolean;
  // Driver's last known position (sent by the driver app); used to find drivers near a homestay
  location?: { lat: number; lng: number; updatedAt: Date } | null;
  locationPoint?: { type: "Point"; coordinates: [number, number] };
  vehicle?: { type?: string; model?: string; plate?: string; seats?: number; area?: string };
  driverCategory?: "INDIVIDUAL" | "UNION";
  unionName?: string;
  pushTokens?: Array<{ token: string; platform: string; updatedAt: Date }>; // Expo tokens, newest last, max 10
  whatsappAlerts?: boolean; // Driver preference: receive trip requests via WhatsApp in addition to push
  ratingSum?: number; // drivers: sum of owner star ratings
  ratingCount?: number;
  tokenVersion?: number; // bumped to revoke every session (logout-all, admin revoke/role change/delete)
  deletedAt?: Date | null; // soft delete by admin (account BLOCKED, money history kept)
  // Consent at signup: Terms + Privacy accepted and 18+ confirmed (version = legal text version shown)
  termsAcceptedAt?: Date | null;
  termsVersion?: string;
  createdAt: Date;
  updatedAt: Date;
  createdAtIST?: string;
  updatedAtIST?: string;
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["guest", "owner", "admin", "driver"], default: "guest", index: true },
    phone: { type: String, default: "" },
    avatar: { type: String, default: "" },
    clerkId: { type: String, sparse: true, unique: true, index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "Property" },
    // Admin-controlled. Only ACTIVE accounts may use the app; drivers start PENDING_APPROVAL.
    accountStatus: { type: String, enum: ["ACTIVE", "PENDING_APPROVAL", "BLOCKED"], default: "ACTIVE", index: true },
    statusReason: { type: String, default: "" },
    isAvailable: { type: Boolean, default: true },
    whatsappAlerts: { type: Boolean, default: true },
    location: { type: { lat: Number, lng: Number, updatedAt: Date, _id: false }, default: null },
    locationPoint: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: undefined },
    },
    vehicle: {
      type: { type: String, default: "" },
      model: { type: String, default: "" },
      plate: { type: String, default: "" },
      seats: { type: Number, default: 0 },
      area: { type: String, default: "" },
    },
    driverCategory: { type: String, enum: ["INDIVIDUAL", "UNION"], default: "INDIVIDUAL" },
    unionName: { type: String, default: "" },
    pushTokens: {
      type: [new Schema({ token: String, platform: String, updatedAt: Date }, { _id: false })],
      default: [],
      select: false, // never returned unless asked for (+pushTokens)
    },
    ratingSum: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    tokenVersion: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
    termsAcceptedAt: { type: Date, default: null },
    termsVersion: { type: String, default: "" },
    createdAtIST: { type: String, default: () => getISTTimestamp() },
    updatedAtIST: { type: String, default: () => getISTTimestamp() },
  },
  { timestamps: true }
);

UserSchema.index({ locationPoint: "2dsphere" });
UserSchema.index({ role: 1, accountStatus: 1, createdAt: -1 });
UserSchema.index({ role: 1, phone: 1 });

// Hash password before saving & update IST timestamp
UserSchema.pre("save", async function () {
  this.updatedAtIST = getISTTimestamp();
  if (!this.createdAtIST) {
    this.createdAtIST = getISTTimestamp();
  }
  if (this.location && typeof this.location.lat === "number" && typeof this.location.lng === "number") {
    (this as any).locationPoint = {
      type: "Point",
      coordinates: [this.location.lng, this.location.lat],
    };
  }
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return await bcrypt.compare(candidate, this.password);
};

export const User = model<IUser>("User", UserSchema);
