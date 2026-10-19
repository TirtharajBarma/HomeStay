import mongoose, { Schema, model, Document } from "mongoose";
import { getISTTimestamp } from "../utils/date.js";
import { tenantDbModel } from "../utils/tenant-model.js";

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
  // Owner's counter-offer on this quote; the driver accepts it (trip confirmed) or keeps his fare
  counterFare?: number | null;
  counterAt?: Date | null;
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
  driverShareOfAdvance?: number; // advance minus PF minus HC, owed by the platform to the driver
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
  // Done by one of the homestay's own drivers (tenant driver id); StayRide charges its own-fleet fee
  ownFleet?: boolean;
  ownDriverId?: number | null;
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
    | "CANCELLED"
    | "EXPIRED";
  cancellationReason?: string;
  needsReassignment: boolean; // paid trip whose driver was removed (blocked); admin must assign a new one
  previousDriverUserIds: string[]; // drivers this trip was taken away from (shown to them as REASSIGNED)
  rating?: { stars: number; comment: string; ratedAt: Date; ratedBy: string } | null;
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
  // false = a guest inquiry the owner has not yet sent to drivers; drivers cannot see or quote it
  dispatched?: boolean;
  // advance must be paid by then or the confirmed driver is released (lazy, see releaseUnpaidAdvances)
  advanceDueAt?: Date | null;
  // Razorpay link for the current advance (replaced if the trip is released and confirmed again)
  paymentLinkId?: string;
  paymentLinkIds?: string[]; // every link ever issued, so a payment on a replaced link is still found
  paymentLinkUrl?: string;
  // Gateway payments that arrived when the request was no longer waiting for them: admin must refund
  unmatchedPayments?: Array<{ paymentId: string; amount: number; status: string; at: Date; refundedAt?: Date | null; refundReference?: string }>;
  // Homestay coordinates at request time: "nearby" is measured from here
  homestayLocation?: { lat: number; lng: number } | null;
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
    counterFare: { type: Number, default: null },
    counterAt: { type: Date, default: null },
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
    driverShareOfAdvance: { type: Number, default: 0 },
    calculatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CabRequestSchema = new Schema<ICabRequest>(
  {
    reference: { type: String, required: true, unique: true, index: true },
    propertyId: { type: Schema.Types.Mixed, required: true, index: true },
    tripId: { type: Number, default: null },
    clientRequestId: { type: String },
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
    dispatched: { type: Boolean, default: true },
    advanceDueAt: { type: Date, default: null },
    ownFleet: { type: Boolean, default: false },
    ownDriverId: { type: Number, default: null },
    paymentLinkId: { type: String, default: "", index: true },
    paymentLinkUrl: { type: String, default: "" },
    paymentLinkIds: { type: [String], default: [], index: true },
    unmatchedPayments: {
      type: [{ paymentId: String, amount: Number, status: String, at: Date, refundedAt: { type: Date, default: null }, refundReference: { type: String, default: "" }, _id: false }],
      default: [],
    },
    homestayLocation: { type: { lat: Number, lng: Number, _id: false }, default: null },
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
        "EXPIRED",
      ],
      default: "FINDING_DRIVER",
      index: true,
    },
    cancellationReason: { type: String, default: "" },
    needsReassignment: { type: Boolean, default: false },
    previousDriverUserIds: { type: [String], default: [] },
    rating: {
      type: new Schema({ stars: Number, comment: String, ratedAt: Date, ratedBy: String }, { _id: false }),
      default: null,
    },
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
// Idempotency keys are per homestay (the old global unique "clientRequestId_1" is dropped by scripts/migrate-indexes.ts).
CabRequestSchema.index(
  { propertyId: 1, clientRequestId: 1 },
  { name: "tenant_client_request_id", unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } }
);

CabRequestSchema.pre("save", function () {
  this.updatedAtIST = getISTTimestamp();
  if (!this.createdAtIST) {
    this.createdAtIST = getISTTimestamp();
  }
});

export function getCabRequestModel(isDemo: boolean = false) {
  // Demo data lives only in "test", everything else only in "production"; the previous fallback to
  // the default connection (production) on a not-ready DB could leak demo requests into production.
  return tenantDbModel(isDemo, "CabRequest", CabRequestSchema) as mongoose.Model<any>;
}

export const CabRequest = model<ICabRequest>("CabRequest", CabRequestSchema);

