import { Schema, model, Document } from "mongoose";

export interface INewsletter extends Document {
  email: string;
  source: string;
  demo: boolean;
  createdAt: Date;
}

const NewsletterSchema = new Schema<INewsletter>(
  {
    email: { type: String, required: true, unique: true, index: true },
    source: { type: String, default: "website" },
    // Landing-page leads are real people: demo-mode admins must not see them.
    demo: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const Newsletter = model<INewsletter>("Newsletter", NewsletterSchema);
