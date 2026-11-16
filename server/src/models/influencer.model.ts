import mongoose, { Schema, Document } from "mongoose";

export interface IInfluencerPackage {
  name: string;
  price: number;
  deliverables: string;
  turnaroundDays?: number;
}

export interface IInfluencer extends Document {
  name: string;
  tagline: string;
  bio: string;
  profilePhoto: string;
  instagramHandle: string;
  instagramUrl: string;
  followersCount: number;
  averageViews: number;
  destinations: string[]; // e.g. ["Darjeeling", "Kalimpong", "Kurseong", "Gangtok", "Sikkim"]
  categories: string[];   // e.g. ["Travel", "Homestay Reviews", "Himalayan Culture", "Food"]
  startingPrice: number;
  packages: IInfluencerPackage[];
  sampleReels: Array<{ title: string; url: string }>;
  isVerified: boolean;
  isFeatured: boolean;
  isActive: boolean;
  contactPhone?: string;
  contactEmail?: string;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InfluencerPackageSchema = new Schema<IInfluencerPackage>(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    deliverables: { type: String, required: true, trim: true },
    turnaroundDays: { type: Number, default: 7 },
  },
  { _id: true }
);

const InfluencerSchema = new Schema<IInfluencer>(
  {
    name: { type: String, required: true, trim: true, index: true },
    tagline: { type: String, default: "", trim: true },
    bio: { type: String, default: "", trim: true },
    profilePhoto: { type: String, default: "", trim: true },
    instagramHandle: { type: String, required: true, trim: true },
    instagramUrl: { type: String, required: true, trim: true },
    followersCount: { type: Number, default: 0, index: true },
    averageViews: { type: Number, default: 0 },
    destinations: {
      type: [String],
      default: ["Darjeeling"],
      index: true,
    },
    categories: {
      type: [String],
      default: ["Travel"],
    },
    startingPrice: { type: Number, default: 0, index: true },
    packages: {
      type: [InfluencerPackageSchema],
      default: [],
    },
    sampleReels: [
      {
        title: { type: String, default: "Sample Reel" },
        url: { type: String, required: true },
      },
    ],
    isVerified: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    contactPhone: { type: String, default: "", trim: true },
    contactEmail: { type: String, default: "", trim: true },
    adminNotes: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

InfluencerSchema.index({ destinations: 1, isActive: 1, isFeatured: -1 });

export const Influencer = (mongoose.models.Influencer as mongoose.Model<IInfluencer>) ||
  mongoose.model<IInfluencer>("Influencer", InfluencerSchema);
