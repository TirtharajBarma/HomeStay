import mongoose, { Schema, model, Document } from "mongoose";
import { getISTTimestamp } from "../utils/date.js";

export interface ITripDestination {
  address: string;
  lat?: number;
  lng?: number;
  order: number;
  note?: string;
}

export interface IDriverQuote {
  driverId: string | number; // platform driver User _id
  vehicleType?: string;
  driverName: string;
  driverPhone: string;
  driverVehicle: string;
  driverRating: number;
  quotedFare: number;
  notes?: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  createdAt: Date;
}

export interface IFinancialSnapshot {
  agreedFare: number;
  advanceAmount: number;
  advancePaid: boolean;
  platformFeeRate: number; // e.g. 0.05 (5%)
  platformFeeAmount: number; // e.g. 150
  homestayCommissionRate: number; // e.g. 0.10 (10%)
  homestayCommissionAmount: number; // e.g. 300
  driverPayoutAmount: number; // e.g. 2550
  remainingCashToDriver: number; // e.g. 2550 or agreedFare - advanceAmount
  calculatedAt: Date;
}

export interface ICabRequest extends Document {
  reference: string; // random, e.g. REQ-9F2A61C04B
  propertyId: Schema.Types.ObjectId | string; // StayRide tenant key (owner email)
  tripId?: number; // id of the mirrored trip in the tenant store
  clientRequestId?: string;
  homestayName: string;
  guestId?: number | string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  pickupLocation: {
    address: string;
    lat?: number;
    lng?: number;
  };
  destinations: ITripDestination[];
  isRoundTrip: boolean;
  returnDate?: number;
  returnTime?: string;
  date: number; // Epoch timestamp ms
  time: string; // e.g. "07:30 AM"
  passengers: number;
  vehicleType: "SUV" | "Sedan" | "7-seater" | "9-seater";
  requestSource: "MANUAL_OWNER" | "NEARBY_BROADCAST" | "GUEST_WEB_LINK" | "ADMIN_DISPATCH";
  assignedDriverId?: string | number;
  assignedDriverName?: string;
  assignedDriverPhone?: string;
  vehicleDetails?: {
    model: string;
    plate: string;
  };
  quotes: IDriverQuote[];
  broadcastExpiresAt?: Date;
  status:
    | "PENDING_REVIEW"
    | "FINDING_DRIVER"
    | "QUOTE_RECEIVED"
    | "AWAITING_ADVANCE_PAYMENT"
    | "CONFIRMED"
    | "EN_ROUTE_PICKUP"
    | "ARRIVED_HOMESTAY"
    | "TRIP_STARTED"
    | "COMPLETED"
    | "CANCELLED";
  cancellationReason?: string;
  agreedFare: number;
  advanceAmount: number;
  advancePaid: boolean;
  advancePaymentId?: string;
  advancePaymentMethod?: string;
  paymentRecordedBy?: string;
  paymentRecordedAt?: Date;
  paymentNote?: string;
  assignedDriverUserId?: string | null;
  hostPayoutId?: string | null; // PayoutRequest that covers this request's homestay commission
  refundStatus: "NONE" | "PENDING" | "REFUNDED";
  refundReference?: string;
  refundedAt?: Date | null;
  voidedPayments: Array<{ transactionId: string; amount: number; method: string; reason: string; voidedBy: string; at: Date }>;
  driverSettlementStatus: "NONE" | "PENDING" | "SETTLED";
  driverSettlementRef?: string;
  driverSettledAt?: Date | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  cancelledBy?: string;
  remainingCashAmount: number; // Cash collected directly by driver during journey
  financialSnapshot?: IFinancialSnapshot;
  guestNotes?: string;
  adminNotes?: string;
  createdAtIST?: string;
  updatedAtIST?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DestinationSchema = new Schema<ITripDestination>(
  {
    address: { type: String, required: true },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    order: { type: Number, required: true, default: 0 },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const DriverQuoteSchema = new Schema<IDriverQuote>(
  {
    driverId: { type: Schema.Types.Mixed, required: true },
    vehicleType: { type: String, default: "" },
    driverName: { type: String, required: true },
    driverPhone: { type: String, required: true },
    driverVehicle: { type: String, required: true },
    driverRating: { type: Number, default: 4.8 },
    quotedFare: { type: Number, required: true },
    notes: { type: String, default: "" },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED", "EXPIRED"],
      default: "PENDING",
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const FinancialSnapshotSchema = new Schema<IFinancialSnapshot>(
  {
    agreedFare: { type: Number, required: true },
    advanceAmount: { type: Number, required: true },
    advancePaid: { type: Boolean, default: false },
    platformFeeRate: { type: Number, required: true },
    platformFeeAmount: { type: Number, required: true },
    homestayCommissionRate: { type: Number, required: true },
    homestayCommissionAmount: { type: Number, required: true },
    driverPayoutAmount: { type: Number, required: true },
    remainingCashToDriver: { type: Number, required: true },
    calculatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CabRequestSchema = new Schema<ICabRequest>(
  {
    reference: { type: String, required: true, unique: true, index: true },
    propertyId: { type: Schema.Types.Mixed, required: true, index: true },
    tripId: { type: Number, default: null },
    clientRequestId: { type: String, unique: true, sparse: true },
    homestayName: { type: String, required: true },
    guestId: { type: Schema.Types.Mixed, default: null },
    guestName: { type: String, required: true },
    guestPhone: { type: String, required: true },
    guestEmail: { type: String, default: "" },
    pickupLocation: {
      address: { type: String, required: true },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    destinations: { type: [DestinationSchema], default: [] },
    isRoundTrip: { type: Boolean, default: false },
    returnDate: { type: Number, default: null },
    returnTime: { type: String, default: "" },
    date: { type: Number, required: true },
    time: { type: String, required: true },
    passengers: { type: Number, default: 2 },
    vehicleType: {
      type: String,
      enum: ["SUV", "Sedan", "7-seater", "9-seater"],
      default: "SUV",
    },
    requestSource: {
      type: String,
      enum: ["MANUAL_OWNER", "NEARBY_BROADCAST", "GUEST_WEB_LINK", "ADMIN_DISPATCH"],
      default: "MANUAL_OWNER",
      index: true,
    },
    assignedDriverId: { type: Schema.Types.Mixed, default: null },
    assignedDriverName: { type: String, default: "" },
    assignedDriverPhone: { type: String, default: "" },
    vehicleDetails: {
      model: { type: String, default: "" },
      plate: { type: String, default: "" },
    },
    quotes: { type: [DriverQuoteSchema], default: [] },
    broadcastExpiresAt: { type: Date, default: null },
    status: {
      type: String,
      enum: [
        "PENDING_REVIEW",
        "FINDING_DRIVER",
        "QUOTE_RECEIVED",
        "AWAITING_ADVANCE_PAYMENT",
        "CONFIRMED",
        "EN_ROUTE_PICKUP",
        "ARRIVED_HOMESTAY",
        "TRIP_STARTED",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "FINDING_DRIVER",
      index: true,
    },
    cancellationReason: { type: String, default: "" },
    agreedFare: { type: Number, default: 0 },
    advanceAmount: { type: Number, default: 0 },
    advancePaid: { type: Boolean, default: false },
    advancePaymentId: { type: String, default: "" },
    advancePaymentMethod: { type: String, default: "" },
    paymentRecordedBy: { type: String, default: "" },
    paymentRecordedAt: { type: Date, default: null },
    paymentNote: { type: String, default: "" },
    assignedDriverUserId: { type: String, default: null, index: true },
    hostPayoutId: { type: String, default: null, index: true },
    refundStatus: { type: String, enum: ["NONE", "PENDING", "REFUNDED"], default: "NONE" },
    refundReference: { type: String, default: "" },
    refundedAt: { type: Date, default: null },
    voidedPayments: {
      type: [
        new Schema(
          { transactionId: String, amount: Number, method: String, reason: String, voidedBy: String, at: Date },
          { _id: false }
        ),
      ],
      default: [],
    },
    driverSettlementStatus: { type: String, enum: ["NONE", "PENDING", "SETTLED"], default: "NONE" },
    driverSettlementRef: { type: String, default: "" },
    driverSettledAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    cancelledBy: { type: String, default: "" },
    remainingCashAmount: { type: Number, default: 0 },
    financialSnapshot: { type: FinancialSnapshotSchema, default: null },
    guestNotes: { type: String, default: "" },
    adminNotes: { type: String, default: "" },
    createdAtIST: { type: String, default: () => getISTTimestamp() },
    updatedAtIST: { type: String, default: () => getISTTimestamp() },
  },
  { timestamps: true }
);

// A bank/UPI transaction can be recorded against only one request.
CabRequestSchema.index(
  { advancePaymentId: 1 },
  { name: "unique_advance_payment_id", unique: true, partialFilterExpression: { advancePaymentId: { $type: "string", $gt: "" } } }
);
CabRequestSchema.index({ propertyId: 1, status: 1 }, { name: "property_status" });

CabRequestSchema.pre("save", function () {
  this.updatedAtIST = getISTTimestamp();
  if (!this.createdAtIST) {
    this.createdAtIST = getISTTimestamp();
  }
});

export function getCabRequestModel(isDemo: boolean = false) {
  const dbName = isDemo ? "test" : "production";
  if (mongoose.connection.readyState === 1) {
    const db = mongoose.connection.useDb(dbName, { useCache: true });
    return db.models.CabRequest || db.model("CabRequest", CabRequestSchema);
  }
  return CabRequest;
}

export const CabRequest = model<ICabRequest>("CabRequest", CabRequestSchema);

