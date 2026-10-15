import mongoose, { Schema, Document } from 'mongoose';

export interface IPayoutRequest extends Document {
  tenantId: string; // Homestay owner email
  homestayName: string;
  ownerName: string;
  ownerPhone: string;
  amount: number; // Commission amount in INR
  payoutMethod: 'UPI' | 'BANK_TRANSFER';
  upiId?: string;
  bankDetails?: {
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
    bankName?: string;
  };
  status: 'PENDING' | 'SETTLED' | 'REJECTED';
  tripIds: number[];
  cabRequestIds: string[]; // CabRequest _ids whose homestay commission this payout covers
  rejectedReason?: string;
  decidedBy?: string;
  utrNumber?: string;
  notes?: string;
  requestedAt: Date;
  settledAt?: Date;
  isDemo: boolean;
}

const PayoutRequestSchema: Schema = new Schema(
  {
    tenantId: { type: String, required: true, lowercase: true, trim: true },
    homestayName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    ownerPhone: { type: String, default: '' },
    amount: { type: Number, required: true, min: 1 },
    payoutMethod: { type: String, enum: ['UPI', 'BANK_TRANSFER'], default: 'UPI' },
    upiId: { type: String, trim: true },
    bankDetails: {
      accountNumber: { type: String, trim: true },
      ifscCode: { type: String, trim: true },
      accountHolderName: { type: String, trim: true },
      bankName: { type: String, trim: true },
    },
    tripIds: { type: [Number], default: [] },
    cabRequestIds: { type: [String], default: [] },
    rejectedReason: { type: String, default: '' },
    decidedBy: { type: String, default: '' },
    status: {
      type: String,
      enum: ['PENDING', 'SETTLED', 'REJECTED'],
      default: 'PENDING',
    },
    utrNumber: { type: String, trim: true },
    notes: { type: String, default: '' },
    requestedAt: { type: Date, default: Date.now },
    settledAt: { type: Date },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// At most one PENDING payout per tenant: parallel requests can't both pass the balance check.
// Explicit names: an older non-unique "tenantId_1" index exists in deployed DBs (see scripts/migrate-indexes.ts).
PayoutRequestSchema.index(
  { tenantId: 1, status: 1 },
  { name: 'one_pending_payout_per_tenant', unique: true, partialFilterExpression: { status: 'PENDING' } }
);
PayoutRequestSchema.index({ status: 1, requestedAt: -1 }, { name: 'status_requestedAt' });

export function getPayoutRequestModel(isDemo: boolean = false): mongoose.Model<IPayoutRequest> {
  const dbName = isDemo ? 'test' : 'production';
  if (mongoose.connection.readyState === 1) {
    const db = mongoose.connection.useDb(dbName, { useCache: true });
    return (db.models.PayoutRequest || db.model<IPayoutRequest>('PayoutRequest', PayoutRequestSchema)) as mongoose.Model<IPayoutRequest>;
  }
  return (mongoose.models.PayoutRequest || mongoose.model<IPayoutRequest>('PayoutRequest', PayoutRequestSchema)) as mongoose.Model<IPayoutRequest>;
}

export const PayoutRequest =
  mongoose.models.PayoutRequest || mongoose.model<IPayoutRequest>('PayoutRequest', PayoutRequestSchema);
