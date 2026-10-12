import { Schema, model, Document } from "mongoose";

export interface IGuest extends Document {
  ownerId?: Schema.Types.ObjectId | string;
  propertyId?: Schema.Types.ObjectId | string;
  name: string;
  code: string;
  room: string;
  location: string;
  category: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  party: number;
  channel: string;
  channelTone: string;
  email: string;
  phone: string;
  origin: string;
  spend: number;
  status:
    | "Arriving today"
    | "In house"
    | "Departing today"
    | "Upcoming"
    | "Past stay";
  tags: string[];
  note?: string;
  vip: boolean;
  stays: number;
  lifetime: number;
  createdAt: Date;
  updatedAt: Date;
}

const GuestSchema = new Schema<IGuest>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", index: true },
    name: { type: String, required: true, index: true },
    code: { type: String, required: true },
    room: { type: String, required: true },
    location: { type: String, default: "" },
    category: {
      type: String,
      required: true,
      default: "Garden Cottages",
    },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number, required: true },
    party: { type: Number, default: 1 },
    channel: { type: String, default: "Direct" },
    channelTone: { type: String, default: "bg-primary-tint text-on-primary-container" },
    email: { type: String, required: true, index: true },
    phone: { type: String, required: true },
    origin: { type: String, default: "Darjeeling, IN" },
    spend: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        "Arriving today",
        "In house",
        "Departing today",
        "Upcoming",
        "Past stay",
      ],
      default: "Upcoming",
      index: true,
    },
    tags: { type: [String], default: [] },
    note: { type: String, default: "" },
    vip: { type: Boolean, default: false },
    stays: { type: Number, default: 1 },
    lifetime: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Guest = model<IGuest>("Guest", GuestSchema);
