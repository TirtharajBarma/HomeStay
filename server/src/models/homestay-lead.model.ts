import { Schema, model, Document } from "mongoose";

export interface IHomestayLead extends Document {
  name: string;
  phone: string;
  location: string;
  rooms: number;
  source: string;
  status: "NEW" | "CONTACTED" | "ONBOARDED" | "REJECTED";
  notes?: string;
  ip?: string;
  createdAt: Date;
  updatedAt: Date;
}

const HomestayLeadSchema = new Schema<IHomestayLead>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    location: { type: String, required: true, trim: true },
    rooms: { type: Number, default: 3 },
    source: { type: String, default: "landing_page_quick_register" },
    status: { type: String, enum: ["NEW", "CONTACTED", "ONBOARDED", "REJECTED"], default: "NEW" },
    notes: { type: String, default: "" },
    ip: { type: String },
  },
  { timestamps: true }
);

export const HomestayLead = model<IHomestayLead>("HomestayLead", HomestayLeadSchema);
