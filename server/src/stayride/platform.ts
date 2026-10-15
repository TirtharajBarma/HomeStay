// Platform cab requests, payments and payouts.
//
// Design (serverless-safe, MongoDB M0 friendly):
// - Every platform trip has exactly one CabRequest document. It is the ONLY source of truth for
//   status, fare, financial snapshot, advance payment, refunds and payout locks. The tenant blob only
//   keeps the owner's copy of the request details (linked by `reference`) and is overlaid on read.
// - Every state change is a single conditional findOneAndUpdate ("only if currently in state X"), so
//   concurrent or repeated calls can never double-apply. No multi-document transaction is needed:
//   multi-step flows (payout request) are ordered so a failure leaves nothing payable twice and a
//   retry is safe.
// - Money values are always computed on the server from admin-controlled rates and frozen in the
//   request's financialSnapshot at the moment a fare is agreed.
import mongoose from 'mongoose';
import { getCabRequestModel } from '../models/cab-request.model.js';
import { getPayoutRequestModel } from '../models/payout-request.model.js';
import { User } from '../models/user.model.js';
import { audit } from '../models/audit-log.model.js';
import { CommissionService } from '../services/commission.service.js';
import { httpError } from '../middlewares/error-handler.js';

export const OPEN_STATUSES = ['PENDING_REVIEW', 'FINDING_DRIVER', 'QUOTE_RECEIVED'];
export const MAX_FARE = 200000; // ₹2,00,000 sanity cap on any single cab fare

export const cabModel = (isDemo: boolean) => getCabRequestModel(isDemo) as mongoose.Model<any>;
export const payoutModel = (isDemo: boolean) => getPayoutRequestModel(isDemo) as unknown as mongoose.Model<any>;

export function userModel(isDemo = false): mongoose.Model<any> {
  const conn = mongoose.connection.useDb(isDemo ? 'test' : 'production', { useCache: true });
  return (conn.models.User || conn.model('User', User.schema)) as mongoose.Model<any>;
}

const conflict = (message: string) => httpError(409, message, 'INVALID_STATE');

export function parseFare(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_FARE) throw httpError(400, `Fare must be between ₹1 and ₹${MAX_FARE.toLocaleString('en-IN')}.`);
  return Math.round(n);
}

function snapshotFrom(split: Awaited<ReturnType<typeof CommissionService.calculateSplit>>) {
  return {
    agreedFare: split.agreedFare,
    advanceAmount: split.advanceAmount,
    advancePaid: false,
    platformFeeRate: split.platformFeeRate,
    platformFeeAmount: split.platformFeeAmount,
    homestayCommissionRate: split.homestayCommissionRate,
    homestayCommissionAmount: split.homestayCommissionAmount,
    driverPayoutAmount: split.driverPayoutAmount,
    remainingCashToDriver: split.remainingCashToDriver,
    calculatedAt: new Date(),
  };
}

async function pricedUpdate(doc: any, fare: number, isDemo: boolean) {
  const split = await CommissionService.calculateSplit(fare, String(doc.propertyId), isDemo);
  return {
    agreedFare: split.agreedFare,
    advanceAmount: split.advanceAmount,
    remainingCashAmount: split.remainingCashToDriver,
    financialSnapshot: snapshotFrom(split),
    driverShareOfAdvance: split.driverShareOfAdvance,
  };
}

// ---------------------------------------------------------------------------
// Read model for the owner app: overlay CabRequest state onto the tenant's trips
// ---------------------------------------------------------------------------
const TRIP_STATUS: Record<string, string> = {
  PENDING_REVIEW: 'FINDING_DRIVER',
  FINDING_DRIVER: 'FINDING_DRIVER',
  QUOTE_RECEIVED: 'QUOTE_RECEIVED',
  AWAITING_ADVANCE_PAYMENT: 'AWAITING_ADVANCE',
  CONFIRMED: 'CONFIRMED',
  EN_ROUTE_PICKUP: 'CONFIRMED',
  ARRIVED_HOMESTAY: 'CONFIRMED',
  TRIP_STARTED: 'TRIP_STARTED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export async function overlayTrips(tenantKey: string, isDemo: boolean, trips: any[]): Promise<any[]> {
  const refs = trips.map((t) => t.reference).filter(Boolean);
  if (!refs.length) return trips.map((t) => ({ ...t, platform: false }));
  const docs = await cabModel(isDemo).find({ propertyId: tenantKey, reference: { $in: refs } }).lean();
  const payoutIds = docs.map((d: any) => d.hostPayoutId).filter(Boolean);
  const payouts = payoutIds.length
    ? await payoutModel(isDemo).find({ _id: { $in: payoutIds } }).select('status').lean()
    : [];
  const payoutStatus = new Map(payouts.map((p: any) => [String(p._id), p.status]));
  const byRef = new Map(docs.map((d: any) => [d.reference, d]));
  return trips.map((t) => {
    const d: any = t.reference ? byRef.get(t.reference) : null;
    if (!d) return { ...t, platform: false };
    const snap = d.financialSnapshot || null;
    const earned = d.status === 'COMPLETED' && d.advancePaid && snap ? snap.homestayCommissionAmount : 0;
    return {
      ...t,
      platform: true,
      status: TRIP_STATUS[d.status] || t.status,
      driverId: d.assignedDriverUserId || null,
      driverName: d.assignedDriverName || null,
      ownerDriver: false,
      fare: d.agreedFare || 0,
      advanceAmount: d.advanceAmount || 0,
      advancePaid: Boolean(d.advancePaid),
      remainingCashAmount: d.remainingCashAmount || 0,
      financialSnapshot: snap,
      commission: earned,
      commissionPaid: Boolean(d.hostPayoutId && payoutStatus.get(String(d.hostPayoutId)) === 'SETTLED'),
      payoutId: d.hostPayoutId || undefined,
      refundStatus: d.refundStatus,
      quotes: (d.quotes || []).map((q: any) => ({
        driverId: String(q.driverId),
        driverName: q.driverName,
        driverVehicle: q.driverVehicle,
        driverRating: q.driverRating,
        quotedFare: q.quotedFare,
        notes: q.notes,
        status: q.status,
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Owner actions on platform requests
// ---------------------------------------------------------------------------
export async function ownerConfirmQuote(tenantKey: string, isDemo: boolean, reference: string, driverUserId: string, actor: string) {
  const Model = cabModel(isDemo);
  const doc: any = await Model.findOne({ reference, propertyId: tenantKey }).lean();
  if (!doc) throw httpError(404, 'Trip not found');
  const quote = (doc.quotes || []).find((q: any) => String(q.driverId) === String(driverUserId) && q.status === 'PENDING');
  if (!quote) throw httpError(400, 'Choose one of the drivers who sent a quote.');
  const driver = await userModel(isDemo).findOne({ _id: quote.driverId, role: 'driver', accountStatus: 'ACTIVE' }).lean();
  if (!driver) throw conflict('This driver is no longer available.');
  // Fare comes from the driver's quote, never from the client.
  const priced = await pricedUpdate(doc, quote.quotedFare, isDemo);
  const updated = await Model.findOneAndUpdate(
    { _id: doc._id, status: { $in: ['FINDING_DRIVER', 'QUOTE_RECEIVED', 'PENDING_REVIEW'] }, advancePaid: { $ne: true } },
    {
      $set: {
        ...priced,
        status: 'AWAITING_ADVANCE_PAYMENT',
        assignedDriverUserId: String(quote.driverId),
        assignedDriverName: quote.driverName,
        assignedDriverPhone: quote.driverPhone,
        vehicleDetails: { model: quote.driverVehicle || '', plate: (driver as any).vehicle?.plate || '' },
        'quotes.$[q].status': 'ACCEPTED',
        'quotes.$[o].status': 'REJECTED',
      },
    },
    {
      returnDocument: 'after',
      arrayFilters: [{ 'q.driverId': quote.driverId }, { 'o.driverId': { $ne: quote.driverId }, 'o.status': 'PENDING' }],
    }
  );
  if (!updated) throw conflict('This request already has a confirmed driver.');
  await audit(actor, 'cab.confirm_quote', 'CabRequest', String(doc._id), { reference, driverUserId, fare: priced.agreedFare }, isDemo);
  return updated;
}

/** Cancel by owner/admin. Paid advances become a PENDING refund that only admin can close. */
export async function cancelRequest(filter: Record<string, any>, isDemo: boolean, actor: string, reason: string) {
  const Model = cabModel(isDemo);
  const doc: any = await Model.findOne(filter).lean();
  if (!doc) throw httpError(404, 'Trip not found');
  if (doc.status === 'CANCELLED') return doc;
  if (['TRIP_STARTED', 'COMPLETED'].includes(doc.status)) throw conflict(`A ${doc.status.toLowerCase().replace('_', ' ')} trip cannot be cancelled.`);
  if (doc.hostPayoutId) throw conflict('This trip is already part of a payout.');
  const updated = await Model.findOneAndUpdate(
    { _id: doc._id, status: { $nin: ['TRIP_STARTED', 'COMPLETED', 'CANCELLED'] }, hostPayoutId: null },
    {
      $set: {
        status: 'CANCELLED',
        cancellationReason: String(reason || '').slice(0, 300),
        cancelledBy: actor,
        refundStatus: doc.advancePaid ? 'PENDING' : 'NONE',
      },
    },
    { returnDocument: 'after' }
  );
  if (!updated) throw conflict('The trip changed meanwhile. Refresh and try again.');
  await audit(actor, 'cab.cancel', 'CabRequest', String(doc._id), { reason, refundDue: doc.advancePaid ? doc.advanceAmount : 0 }, isDemo);
  return updated;
}

// ---------------------------------------------------------------------------
// Driver actions (platform drivers approved by admin)
// ---------------------------------------------------------------------------
export function sanitizeOpenRequest(d: any, driverUserId: string) {
  const mine = (d.quotes || []).find((q: any) => String(q.driverId) === driverUserId);
  // No guest identity before the driver is assigned.
  return {
    reference: d.reference,
    homestayName: d.homestayName,
    pickup: d.pickupLocation?.address || '',
    destinations: d.destinations || [],
    destination: (d.destinations || []).map((x: any) => x.address).join(' ➔ '),
    isRoundTrip: d.isRoundTrip,
    returnDate: d.returnDate,
    returnTime: d.returnTime,
    date: d.date,
    time: d.time,
    passengers: d.passengers,
    vehicleType: d.vehicleType,
    status: TRIP_STATUS[d.status] || d.status,
    myQuote: mine ? { quotedFare: mine.quotedFare, status: mine.status } : null,
    assignedToMe: false,
  };
}

export function assignedTripForDriver(d: any) {
  return {
    ...sanitizeOpenRequest(d, ''),
    guestName: d.guestName,
    phone: d.guestPhone,
    fare: d.agreedFare,
    advanceAmount: d.advanceAmount,
    advancePaid: d.advancePaid,
    remainingCashAmount: d.advancePaid ? d.remainingCashAmount : d.agreedFare, // cash due from guest
    assignedToMe: true,
  };
}

export async function driverSubmitQuote(isDemo: boolean, reference: string, driver: any, fareInput: unknown, notes: unknown) {
  const quotedFare = parseFare(fareInput);
  const Model = cabModel(isDemo);
  const driverId = String(driver._id);
  const quote = {
    driverId,
    driverName: driver.name,
    driverPhone: driver.phone || '',
    driverVehicle: [driver.vehicle?.model, driver.vehicle?.plate].filter(Boolean).join(' ') || driver.vehicle?.type || '',
    vehicleType: driver.vehicle?.type || '',
    driverRating: 0,
    quotedFare,
    notes: typeof notes === 'string' ? notes.slice(0, 300) : '',
    status: 'PENDING',
    createdAt: new Date(),
  };
  // Replace this driver's previous quote (if any) while the request is still open.
  await Model.updateOne({ reference, status: { $in: OPEN_STATUSES } }, { $pull: { quotes: { driverId } } });
  const updated = await Model.findOneAndUpdate(
    { reference, status: { $in: OPEN_STATUSES } },
    { $push: { quotes: quote }, $set: { status: 'QUOTE_RECEIVED' } },
    { returnDocument: 'after' }
  );
  if (!updated) throw conflict('This request is no longer accepting quotes.');
  return updated;
}

async function transition(isDemo: boolean, filter: Record<string, any>, set: Record<string, any>, notFound: string) {
  const updated = await cabModel(isDemo).findOneAndUpdate(filter, { $set: set }, { returnDocument: 'after' });
  if (!updated) throw conflict(notFound);
  return updated;
}

export async function startTrip(isDemo: boolean, filter: Record<string, any>, actor: string) {
  // Only after the advance is paid (CONFIRMED).
  const updated = await transition(isDemo, { ...filter, status: 'CONFIRMED', advancePaid: true }, { status: 'TRIP_STARTED', startedAt: new Date() }, 'Trip can start only after the advance is paid.');
  await audit(actor, 'cab.start', 'CabRequest', String(updated._id), {}, isDemo);
  return updated;
}

export async function completeTrip(isDemo: boolean, filter: Record<string, any>, actor: string) {
  const doc: any = await cabModel(isDemo).findOne(filter).lean();
  if (!doc) throw httpError(404, 'Trip not found');
  const s = doc.financialSnapshot;
  const driverShare = s ? s.advanceAmount - s.platformFeeAmount - s.homestayCommissionAmount : 0;
  const updated = await transition(
    isDemo,
    { _id: doc._id, status: 'TRIP_STARTED' },
    { status: 'COMPLETED', completedAt: new Date(), driverSettlementStatus: driverShare > 0 ? 'PENDING' : 'NONE' },
    'Only a started trip can be completed.'
  );
  await audit(actor, 'cab.complete', 'CabRequest', String(doc._id), { driverShareOfAdvance: driverShare }, isDemo);
  return updated;
}

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------
export async function adminAssignDriver(isDemo: boolean, id: string, body: any, actor: string) {
  const Model = cabModel(isDemo);
  const doc: any = await Model.findById(id).lean();
  if (!doc) throw httpError(404, 'Cab request not found.');
  const fare = parseFare(body.agreedFare);
  let name = String(body.assignedDriverName || '').trim().slice(0, 100);
  let phone = String(body.assignedDriverPhone || '').trim().slice(0, 20);
  let driverUserId: string | null = null;
  let plate = String(body.vehiclePlate || '').slice(0, 20);
  if (body.driverUserId) {
    const driver: any = await userModel(isDemo).findOne({ _id: body.driverUserId, role: 'driver', accountStatus: 'ACTIVE' }).lean();
    if (!driver) throw httpError(400, 'Driver not found or not approved.');
    driverUserId = String(driver._id);
    name = driver.name;
    phone = driver.phone || '';
    plate = plate || driver.vehicle?.plate || '';
  }
  if (!name || !phone) throw httpError(400, 'Driver name and phone are required.');
  const priced = await pricedUpdate(doc, fare, isDemo);
  const updated = await transition(
    isDemo,
    { _id: doc._id, status: { $in: [...OPEN_STATUSES, 'AWAITING_ADVANCE_PAYMENT'] }, advancePaid: { $ne: true } },
    {
      ...priced,
      status: 'AWAITING_ADVANCE_PAYMENT',
      assignedDriverUserId: driverUserId,
      assignedDriverName: name,
      assignedDriverPhone: phone,
      vehicleDetails: { model: String(body.vehicleModel || doc.vehicleType || '').slice(0, 60), plate },
    },
    'Request is no longer open for assignment (already paid, started, completed or cancelled).'
  );
  await audit(actor, 'cab.assign_driver', 'CabRequest', id, { fare, driverUserId, name }, isDemo);
  return updated;
}

const PAYMENT_METHODS = ['UPI', 'BANK_TRANSFER', 'CASH', 'GATEWAY'];

export async function adminRecordPayment(isDemo: boolean, id: string, body: any, actor: string) {
  const transactionId = String(body.transactionId || '').trim().slice(0, 100);
  if (!transactionId) throw httpError(400, 'Transaction ID is required.');
  if (!PAYMENT_METHODS.includes(body.method)) throw httpError(400, `Method must be one of ${PAYMENT_METHODS.join(', ')}.`);
  const Model = cabModel(isDemo);
  const doc: any = await Model.findById(id).lean();
  if (!doc) throw httpError(404, 'Cab request not found.');
  const paid = Number(body.amount);
  if (!Number.isFinite(paid) || paid < doc.advanceAmount || paid > doc.agreedFare) {
    throw httpError(400, `Amount must be between the advance ₹${doc.advanceAmount} and the fare ₹${doc.agreedFare}.`);
  }
  if (await Model.exists({ advancePaymentId: transactionId })) throw conflict('This transaction ID is already recorded on another request.');
  let updated;
  try {
    updated = await transition(
      isDemo,
      { _id: doc._id, status: 'AWAITING_ADVANCE_PAYMENT', advancePaid: { $ne: true } },
      {
        advancePaid: true,
        'financialSnapshot.advancePaid': true,
        advancePaymentId: transactionId,
        advancePaymentMethod: body.method,
        paymentRecordedBy: actor,
        paymentRecordedAt: new Date(),
        paymentNote: String(body.note || '').slice(0, 500),
        status: 'CONFIRMED',
      },
      'Request is not awaiting an advance payment.'
    );
  } catch (err: any) {
    if (err?.code === 11000) throw conflict('This transaction ID is already recorded on another request.');
    throw err;
  }
  await audit(actor, 'payment.record', 'CabRequest', id, { transactionId, amount: paid, method: body.method }, isDemo);
  return updated;
}

/** Undo a wrongly recorded payment. Only before the trip starts and before any payout. */
export async function adminVoidPayment(isDemo: boolean, id: string, reason: unknown, actor: string) {
  const why = String(reason || '').trim().slice(0, 300);
  if (!why) throw httpError(400, 'A reason is required to void a payment.');
  const Model = cabModel(isDemo);
  const doc: any = await Model.findById(id).lean();
  if (!doc) throw httpError(404, 'Cab request not found.');
  const updated = await Model.findOneAndUpdate(
    { _id: doc._id, status: 'CONFIRMED', advancePaid: true, hostPayoutId: null },
    {
      $set: {
        advancePaid: false,
        'financialSnapshot.advancePaid': false,
        advancePaymentId: '',
        advancePaymentMethod: '',
        status: 'AWAITING_ADVANCE_PAYMENT',
      },
      $push: {
        voidedPayments: { transactionId: doc.advancePaymentId, amount: doc.advanceAmount, method: doc.advancePaymentMethod, reason: why, voidedBy: actor, at: new Date() },
      },
    },
    { returnDocument: 'after' }
  );
  if (!updated) throw conflict('Only a confirmed, not-yet-started payment can be voided.');
  await audit(actor, 'payment.void', 'CabRequest', id, { transactionId: doc.advancePaymentId, reason: why }, isDemo);
  return updated;
}

export async function adminMarkRefunded(isDemo: boolean, id: string, reference: unknown, actor: string) {
  const ref = String(reference || '').trim().slice(0, 100);
  if (!ref) throw httpError(400, 'Refund reference (UTR) is required.');
  const updated = await transition(
    isDemo,
    { _id: id, status: 'CANCELLED', refundStatus: 'PENDING' },
    { refundStatus: 'REFUNDED', refundReference: ref, refundedAt: new Date() },
    'No pending refund on this request.'
  );
  await audit(actor, 'payment.refund', 'CabRequest', id, { reference: ref, amount: updated.advanceAmount }, isDemo);
  return updated;
}

export async function adminSettleDriver(isDemo: boolean, id: string, reference: unknown, actor: string) {
  const ref = String(reference || '').trim().slice(0, 100);
  if (!ref) throw httpError(400, 'Transfer reference (UTR) is required.');
  const updated = await transition(
    isDemo,
    { _id: id, status: 'COMPLETED', driverSettlementStatus: 'PENDING' },
    { driverSettlementStatus: 'SETTLED', driverSettlementRef: ref, driverSettledAt: new Date() },
    'No pending driver settlement on this request.'
  );
  await audit(actor, 'driver.settle', 'CabRequest', id, { reference: ref }, isDemo);
  return updated;
}

// ---------------------------------------------------------------------------
// Homestay commission payouts
// ---------------------------------------------------------------------------
// Payable = commission on platform trips that were completed AND whose advance the platform
// actually collected, not yet locked by any payout.
const eligibleFilter = (tenantKey: string) => ({
  propertyId: tenantKey,
  status: 'COMPLETED',
  advancePaid: true,
  hostPayoutId: null,
  'financialSnapshot.homestayCommissionAmount': { $gt: 0 },
});

export async function payoutSummary(tenantKey: string, isDemo: boolean) {
  const [eligible, pending] = await Promise.all([
    cabModel(isDemo).find(eligibleFilter(tenantKey)).select('financialSnapshot.homestayCommissionAmount').lean(),
    payoutModel(isDemo).findOne({ tenantId: tenantKey, status: 'PENDING' }).lean(),
  ]);
  const available = eligible.reduce((a: number, d: any) => a + d.financialSnapshot.homestayCommissionAmount, 0);
  return { available, eligibleTrips: eligible.length, pendingPayout: pending ? { id: String((pending as any)._id), amount: (pending as any).amount } : null };
}

export async function requestPayout(tenantKey: string, isDemo: boolean, owner: { name: string; phone: string; homestayName: string }, body: any, actor: string) {
  const method = body.payoutMethod === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'UPI';
  const upiId = typeof body.upiId === 'string' ? body.upiId.trim().slice(0, 100) : '';
  const bank = body.bankDetails || {};
  if (method === 'UPI' && !/^[\w.\-]{2,}@[\w]{2,}$/.test(upiId)) throw httpError(400, 'A valid UPI ID (e.g. yourname@okhdfcbank) is required.');
  if (method === 'BANK_TRANSFER' && (!bank.accountNumber || !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(String(bank.ifscCode || '')))) {
    throw httpError(400, 'Valid bank account number and IFSC code are required.');
  }

  const Cab = cabModel(isDemo);
  const Payout = payoutModel(isDemo);
  if (await Payout.exists({ tenantId: tenantKey, status: 'PENDING' })) throw conflict('You already have a payout request pending.');
  const eligible = await Cab.find(eligibleFilter(tenantKey)).select('_id tripId financialSnapshot.homestayCommissionAmount').lean();
  const amount = eligible.reduce((a: number, d: any) => a + d.financialSnapshot.homestayCommissionAmount, 0);
  if (amount <= 0) throw httpError(400, 'You have no eligible commission to withdraw yet.');
  if (body.expectedAmount !== undefined && Number(body.expectedAmount) !== amount) {
    throw conflict(`Your balance changed to ₹${amount.toLocaleString('en-IN')}. Please review and request again.`);
  }

  // 1. Create the PENDING payout (unique index: one pending per tenant).
  const payoutId = new mongoose.Types.ObjectId();
  try {
    await Payout.create({
      _id: payoutId,
      tenantId: tenantKey,
      homestayName: owner.homestayName || 'Homestay',
      ownerName: owner.name || tenantKey,
      ownerPhone: owner.phone || '',
      amount,
      cabRequestIds: eligible.map((d: any) => String(d._id)),
      tripIds: eligible.map((d: any) => d.tripId).filter((x: any) => typeof x === 'number'),
      payoutMethod: method,
      upiId: method === 'UPI' ? upiId : undefined,
      bankDetails: method === 'BANK_TRANSFER'
        ? { accountNumber: String(bank.accountNumber).slice(0, 30), ifscCode: String(bank.ifscCode).toUpperCase(), accountHolderName: String(bank.accountHolderName || '').slice(0, 100), bankName: String(bank.bankName || '').slice(0, 100) }
        : undefined,
      status: 'PENDING',
      isDemo,
      requestedAt: new Date(),
    });
  } catch (err: any) {
    if (err?.code === 11000) throw conflict('You already have a payout request pending.');
    throw err;
  }

  // 2. Lock exactly those requests to this payout (only if still unlocked).
  const ids = eligible.map((d: any) => d._id);
  const lock = await Cab.updateMany({ _id: { $in: ids }, hostPayoutId: null }, { $set: { hostPayoutId: String(payoutId) } });
  if (lock.modifiedCount !== ids.length) {
    // Someone else locked some of them: roll back ours and refuse.
    await Cab.updateMany({ hostPayoutId: String(payoutId) }, { $set: { hostPayoutId: null } });
    await Payout.deleteOne({ _id: payoutId, status: 'PENDING' });
    throw conflict('Your balance changed. Please try again.');
  }
  await audit(actor, 'payout.request', 'PayoutRequest', String(payoutId), { tenantKey, amount, count: ids.length }, isDemo);
  return Payout.findById(payoutId).lean();
}

export async function settlePayout(isDemo: boolean, id: string, utrNumber: unknown, notes: unknown, actor: string) {
  const utr = String(utrNumber || '').trim().slice(0, 100);
  if (!utr) throw httpError(400, 'UTR / reference number is required.');
  const Payout = payoutModel(isDemo);
  const payout: any = await Payout.findById(id).lean();
  if (!payout) throw httpError(404, 'Payout not found.');
  // Verify every locked request still belongs to this payout and its total matches before paying.
  const locked = await cabModel(isDemo).find({ hostPayoutId: String(payout._id) }).select('financialSnapshot.homestayCommissionAmount').lean();
  const total = locked.reduce((a: number, d: any) => a + (d.financialSnapshot?.homestayCommissionAmount || 0), 0);
  if (locked.length !== (payout.cabRequestIds || []).length || total !== payout.amount) {
    throw conflict('Payout does not match its locked trips. Reject it and ask the homestay to request again.');
  }
  const updated = await Payout.findOneAndUpdate(
    { _id: payout._id, status: 'PENDING' },
    { $set: { status: 'SETTLED', utrNumber: utr, notes: String(notes || '').slice(0, 500), settledAt: new Date(), decidedBy: actor } },
    { returnDocument: 'after' }
  );
  if (!updated) throw conflict('Payout is not pending (already settled or rejected).');
  await audit(actor, 'payout.settle', 'PayoutRequest', id, { utr, amount: payout.amount, tenantKey: payout.tenantId }, isDemo);
  return updated;
}

export async function rejectPayout(isDemo: boolean, id: string, reason: unknown, actor: string) {
  const why = String(reason || '').trim().slice(0, 300);
  if (!why) throw httpError(400, 'A reason is required.');
  const updated = await payoutModel(isDemo).findOneAndUpdate(
    { _id: id, status: 'PENDING' },
    { $set: { status: 'REJECTED', rejectedReason: why, decidedBy: actor, settledAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!updated) throw conflict('Payout is not pending.');
  // Unlock its trips so they can be requested again (idempotent; safe to retry).
  await cabModel(isDemo).updateMany({ hostPayoutId: String(id) }, { $set: { hostPayoutId: null } });
  await audit(actor, 'payout.reject', 'PayoutRequest', id, { reason: why, amount: (updated as any).amount }, isDemo);
  return updated;
}
