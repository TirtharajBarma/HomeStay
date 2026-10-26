import mongoose, { Schema, Document } from 'mongoose';
import { tenantDbModel } from '../utils/tenant-model.js';

export interface IPayoutRequest extends Document {
  recipientType: 'HOMESTAY' | 'DRIVER';
  tenantId?: string; // Homestay owner email (for HOMESTAY payouts)
  driverId?: string; // Driver user ID or phone (for DRIVER payouts)
  driverName?: string;
  driverPhone?: string;
  homestayName: string;
  ownerName: string;
  ownerPhone: string;
  amount: number; // Commission or excess advance share amount in INR
  method: 'UPI' | 'BANK_TRANSFER';
  upiId?: string;
  bank?: {
    accountName: string;
    accountNumber: string;
    ifsc: string;
    bankName?: string;
  };
  status: 'PENDING' | 'SETTLED' | 'REJECTED';
  tripIds: number[];
  cabRequestIds: string[]; // CabRequest _ids covered by this payout
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
    recipientType: { type: String, enum: ['HOMESTAY', 'DRIVER'], default: 'HOMESTAY', index: true },
    tenantId: { type: String, lowercase: true, trim: true, default: '' },
    driverId: { type: String, trim: true, default: '' },
    driverName: { type: String, default: '' },
    driverPhone: { type: String, default: '' },
    homestayName: { type: String, default: '', trim: true },
    ownerName: { type: String, default: '', trim: true },
    ownerPhone: { type: String, default: '' },
    amount: { type: Number, required: true, min: 1 },
    method: { type: String, enum: ['UPI', 'BANK_TRANSFER'], default: 'UPI' },
    upiId: { type: String, trim: true },
    bank: {
      type: new Schema(
        { accountName: String, accountNumber: String, ifsc: String, bankName: String },
        { _id: false }
      ),
      default: undefined,
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

// At most one PENDING payout per homestay tenant
PayoutRequestSchema.index(
  { tenantId: 1, status: 1 },
  { name: 'one_pending_payout_per_tenant', unique: true, partialFilterExpression: { recipientType: 'HOMESTAY', status: 'PENDING' } }
);

// At most one PENDING payout per driver
PayoutRequestSchema.index(
  { driverId: 1, status: 1 },
  { name: 'one_pending_payout_per_driver', unique: true, partialFilterExpression: { recipientType: 'DRIVER', status: 'PENDING' } }
);
PayoutRequestSchema.index({ status: 1, requestedAt: -1 }, { name: 'status_requestedAt' });

export function getPayoutRequestModel(isDemo: boolean = false): mongoose.Model<IPayoutRequest> {
  // Demo data lives only in "test", everything else only in "production"; never fall back to the
  // default connection (production) when the DB is not ready.
  return tenantDbModel(isDemo, 'PayoutRequest', PayoutRequestSchema) as mongoose.Model<IPayoutRequest>;
}

export const PayoutRequest =
  mongoose.models.PayoutRequest || mongoose.model<IPayoutRequest>('PayoutRequest', PayoutRequestSchema);
