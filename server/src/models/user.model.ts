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
  vehicle?: { type?: string; model?: string; plate?: string; seats?: number; area?: string };
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
    clerkId: { type: String, sparse: true, index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "Property" },
    // Admin-controlled. Only ACTIVE accounts may use the app; drivers start PENDING_APPROVAL.
    accountStatus: { type: String, enum: ["ACTIVE", "PENDING_APPROVAL", "BLOCKED"], default: "ACTIVE", index: true },
    statusReason: { type: String, default: "" },
    isAvailable: { type: Boolean, default: true },
    vehicle: {
      type: { type: String, default: "" },
      model: { type: String, default: "" },
      plate: { type: String, default: "" },
      seats: { type: Number, default: 0 },
      area: { type: String, default: "" },
    },
    createdAtIST: { type: String, default: () => getISTTimestamp() },
    updatedAtIST: { type: String, default: () => getISTTimestamp() },
  },
  { timestamps: true }
);

// Hash password before saving & update IST timestamp
UserSchema.pre("save", async function () {
  this.updatedAtIST = getISTTimestamp();
  if (!this.createdAtIST) {
    this.createdAtIST = getISTTimestamp();
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
