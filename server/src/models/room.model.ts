import { Schema, model, Document } from "mongoose";

export interface IGalleryShot {
  src: string;
  alt: string;
  caption: string;
}

export interface IReview {
  name: string;
  initials: string;
  stayed: string;
  quote: string;
  tone: "clay" | "sage" | "sand";
}

export interface IFact {
  icon: string;
  label: string;
  value: string;
}

export interface IRoom extends Document {
  ownerId?: Schema.Types.ObjectId | string;
  propertyId?: Schema.Types.ObjectId | string;
  homestayName?: string;
  code: string;
  slug: string;
  name: string;
  wing: string;
  location: string;
  category: string;
  kind: "cottage" | "loft" | "cabin";
  kindLabel: string;
  status: "Active" | "Maintenance";
  petFriendly: boolean;
  maxGuests: number;
  occupancy: string;
  nightly: number;
  weekend?: number;
  bedLabel: string;
  bedIcon: string;
  blurb: string;
  amenities: string[];
  highlight: {
    icon: string;
    label: string;
  };
  rating: number;
  reviewCount: number;
  eyebrow: string;
  intro: string;
  image: string;
  imageAlt: string;
  gallery: IGalleryShot[];
  facts: IFact[];
  story: string[];
  reviews: IReview[];
  hold?: {
    label: string;
    range: string;
    startDate?: string;
    endDate?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const RoomSchema = new Schema<IRoom>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", index: true },
    homestayName: { type: String, default: "" },
    code: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, trim: true, index: true },
    name: { type: String, required: true },
    wing: { type: String, default: "" },
    location: { type: String, required: true },
    category: {
      type: String,
      required: true,
      default: "Garden Cottages",
    },
    kind: {
      type: String,
      required: true,
      default: "cottage",
    },
    kindLabel: { type: String, default: "" },
    status: {
      type: String,
      required: true,
      enum: ["Active", "Maintenance"],
      default: "Active",
    },
    petFriendly: { type: Boolean, default: false },
    maxGuests: { type: Number, required: true, default: 2 },
    occupancy: { type: String, default: "" },
    nightly: { type: Number, required: true },
    weekend: { type: Number },
    bedLabel: { type: String, default: "" },
    bedIcon: { type: String, default: "king_bed" },
    blurb: { type: String, default: "" },
    amenities: { type: [String], default: [] },
    highlight: {
      icon: { type: String, default: "coffee" },
      label: { type: String, default: "Breakfast included" },
    },
    rating: { type: Number, default: 4.9 },
    reviewCount: { type: Number, default: 0 },
    eyebrow: { type: String, default: "" },
    intro: { type: String, default: "" },
    image: { type: String, required: true },
    imageAlt: { type: String, default: "" },
    gallery: [
      {
        src: { type: String, required: true },
        alt: { type: String, default: "" },
        caption: { type: String, default: "" },
      },
    ],
    facts: [
      {
        icon: { type: String, default: "" },
        label: { type: String, default: "" },
        value: { type: String, default: "" },
      },
    ],
    story: { type: [String], default: [] },
    reviews: [
      {
        name: { type: String, required: true },
        initials: { type: String, default: "" },
        stayed: { type: String, default: "" },
        quote: { type: String, default: "" },
        tone: { type: String, enum: ["clay", "sage", "sand"], default: "sand" },
      },
    ],
    hold: {
      label: { type: String },
      range: { type: String },
      startDate: { type: String },
      endDate: { type: String },
    },
  },
  { timestamps: true }
);

// Tenant-scoped compound indexes
RoomSchema.index({ propertyId: 1, code: 1 });
RoomSchema.index({ propertyId: 1, slug: 1 });

export const Room = model<IRoom>("Room", RoomSchema);
