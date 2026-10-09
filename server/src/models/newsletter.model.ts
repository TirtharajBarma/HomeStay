import { Schema, model, Document } from "mongoose";

export interface INewsletter extends Document {
  email: string;
  source: string;
  createdAt: Date;
}

const NewsletterSchema = new Schema<INewsletter>(
  {
    email: { type: String, required: true, unique: true, index: true },
    source: { type: String, default: "website" },
  },
  { timestamps: true }
);

export const Newsletter = model<INewsletter>("Newsletter", NewsletterSchema);
