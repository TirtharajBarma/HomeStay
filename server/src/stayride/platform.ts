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
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { getGuestLinkModel } from '../models/guest-link.model.js';
import { sendWhatsApp, WhatsAppMessage, WhatsAppResult } from '../services/whatsapp.service.js';
import * as messages from './messages.js';
import { parseTime12 } from './time.js';
import { getCabRequestModel } from '../models/cab-request.model.js';
import { getPayoutRequestModel } from '../models/payout-request.model.js';
import { User } from '../models/user.model.js';
import { audit } from '../models/audit-log.model.js';
import { CommissionService } from '../services/commission.service.js';
import { httpError } from '../middlewares/error-handler.js';
import { tenantDbModel } from '../utils/tenant-model.js';
import { notify, PushMessage } from '../services/push.service.js';
import { createPaymentLink } from '../services/payment-gateway.service.js';
import { PlatformConfig, ownFleetFee } from '../services/platform-config.js';

export const OPEN_STATUSES = ['PENDING_REVIEW', 'FINDING_DRIVER', 'QUOTE_RECEIVED'];
// Paid (advance collected) but not started: the only states where a removed driver can be replaced.
const PAID_NOT_STARTED = ['CONFIRMED', 'EN_ROUTE_PICKUP', 'ARRIVED_HOMESTAY'];
const HOUR_MS = 3600000;
const DAY_MS = 86400000;
const IST_OFFSET_MS = 330 * 60000;
export const MAX_FARE = 200000; // fallback cap; the admin's maxFare setting is used where it is known
const cfgOf = (isDemo: boolean) => CommissionService.getPlatformConfig(isDemo);

export const cabModel = (isDemo: boolean) => getCabRequestModel(isDemo) as mongoose.Model<any>;
export const payoutModel = (isDemo: boolean) => getPayoutRequestModel(isDemo) as unknown as mongoose.Model<any>;
/** Audit scope of a cab request, so the admin's homestay / driver audit filters find it. */
const scope = (d: any) => ({ tenantId: String(d?.propertyId || ''), driverId: String(d?.assignedDriverUserId || '') });

export function userModel(isDemo = false): mongoose.Model<any> {
  // Demo users live only in "test", everyone else only in "production"; never fall back to the
  // default connection (which points at production) when the DB is not ready.
  return tenantDbModel(isDemo, 'User', User.schema);
}

const conflict = (message: string) => httpError(409, message, 'INVALID_STATE');

export const pushOwner = (isDemo: boolean, tenantKey: string, msg: PushMessage) => notify(isDemo, { email: tenantKey, role: 'owner' }, msg);
const pushUsers = (isDemo: boolean, ids: unknown[], msg: PushMessage) => {
  const valid = [...new Set(ids.map(String))].filter((id) => mongoose.Types.ObjectId.isValid(id));
  return valid.length ? notify(isDemo, { _id: { $in: valid } }, msg) : Promise.resolve();
};
const tripData = (d: any, type: string) => ({ type, reference: d.reference, ...(typeof d.tripId === 'number' ? { tripId: d.tripId } : {}) });

/** WhatsApp from the company number. Every message is also pushed to the app where the person has it. */
const whatsapp = async (isDemo: boolean, to: unknown, built: Omit<WhatsAppMessage, 'to'>): Promise<WhatsAppResult> => {
  const cfg = await cfgOf(isDemo);
  return sendWhatsApp(isDemo, { ...built, to: String(to ?? '') }, cfg.whatsappLanguage, cfg.whatsappTemplates[built.event]);
};

export const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

// ---------------------------------------------------------------------------
// Driver quote links: a signed, expiring link per driver and request, so WhatsApp-only drivers can
// quote (or accept a counter-offer) on a web page without opening the app. Bound to that driver.
// ---------------------------------------------------------------------------
export function driverQuoteLink(isDemo: boolean, driverId: unknown, reference: string) {
  const token = jwt.sign({ typ: 'dq', d: String(driverId), r: reference, x: isDemo ? 1 : 0 }, config.jwtSecret, { expiresIn: '4d' });
  return `${config.guestWebUrl}/driver-quote?t=${encodeURIComponent(token)}`;
}

export function readDriverQuoteToken(token: unknown): { driverId: string; reference: string; isDemo: boolean } | null {
  if (typeof token !== 'string' || token.length > 2000) return null;
  try {
    const p: any = jwt.verify(token, config.jwtSecret);
    if (p?.typ !== 'dq' || typeof p.d !== 'string' || typeof p.r !== 'string') return null;
    return { driverId: p.d, reference: p.r, isDemo: p.x === 1 };
  } catch {
    return null;
  }
}

/** Opaque, expiring guest link (validity set by the admin). Only its hash is stored; the raw URL is returned once. */
export async function issueGuestLink(tenantKey: string, isDemo: boolean, guest: { guestId?: number | null; guestName: string; guestPhone: string }) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + (await cfgOf(isDemo)).guestLinkDays * DAY_MS);
  const doc = await getGuestLinkModel(isDemo).create({
    tokenHash: hashToken(token),
    tenantKey,
    guestId: guest.guestId ?? null,
    guestName: guest.guestName,
    guestPhone: guest.guestPhone,
    expiresAt,
  });
  return { id: doc._id, url: `${config.guestWebUrl}/cab-request?t=${token}`, expiresAt: expiresAt.getTime() };
}

const last10 = (p: unknown) => String(p ?? '').replace(/\D/g, '').slice(-10);

/**
 * Ask a guest for a cab request from the company WhatsApp number. One message per guest per cooldown
 * (admin setting): every send costs money and spam reports put the company number at risk.
 */
export async function sendAskCab(
  tenantKey: string,
  isDemo: boolean,
  homestayName: string,
  guest: { guestId?: number | null; guestName: string; guestPhone: string; checkInDate?: Date | string | number | null }
) {
  const cfg = await cfgOf(isDemo);
  const Links = getGuestLinkModel(isDemo);
  if (cfg.askCabCooldownHours > 0) {
    const since = new Date(Date.now() - cfg.askCabCooldownHours * HOUR_MS);
    const recent: any[] = await Links.find({ tenantKey, sentAt: { $gt: since } }).select('guestPhone sentAt').limit(500).lean();
    const hit = recent.find((l) => last10(l.guestPhone) === last10(guest.guestPhone));
    if (hit) {
      const next = new Date(new Date(hit.sentAt).getTime() + cfg.askCabCooldownHours * HOUR_MS);
      throw httpError(429, `${guest.guestName} was already asked recently. You can ask again after ${next.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}.`, 'ASK_CAB_COOLDOWN');
    }
  }
  const link = await issueGuestLink(tenantKey, isDemo, guest);

  // Context-aware message: future booking gets airport/railway transfer focus; walk-in / today gets sightseeing
  let msg;
  if (guest.checkInDate) {
    const target = new Date(guest.checkInDate).getTime();
    const now = Date.now();
    if (target > now + 24 * 3600 * 1000) {
      const dateStr = new Date(target).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
      msg = messages.preArrivalTransferMessage(guest.guestName, homestayName || 'our homestay', link.url, dateStr);
    } else {
      msg = messages.welcomeSightseeingMessage(guest.guestName, homestayName || 'our homestay', link.url);
    }
  } else {
    msg = messages.askCabMessage(guest.guestName, homestayName || 'our homestay', link.url);
  }

  const result = await whatsapp(isDemo, guest.guestPhone, msg);
  if (result === 'SENT') await Links.updateOne({ _id: link.id }, { $set: { sentAt: new Date() } });
  return { result, expiresAt: link.expiresAt, url: link.url };
}

const dueAt = (cfg: PlatformConfig) => (cfg.advanceWindowMin > 0 ? new Date(Date.now() + cfg.advanceWindowMin * 60000) : null);

/**
 * The request now waits for its advance: give the guest a way to pay. With the gateway on that is a
 * Razorpay link (paid → webhook records it); otherwise the guest's status page, and StayRide records
 * the payment by hand. Never throws: the state change before it is already committed.
 */
export async function requestAdvance(tenantKey: string, isDemo: boolean, doc: any): Promise<void> {
  try {
    const cfg = await cfgOf(isDemo);
    const link = isDemo
      ? null
      : await createPaymentLink({
          amountRupees: doc.advanceAmount,
          reference: doc.reference,
          guestName: doc.guestName,
          guestPhone: doc.guestPhone,
          description: `StayRide cab advance for trip ${doc.reference}`,
          expiresAt: doc.advanceDueAt ? new Date(doc.advanceDueAt) : null,
        });
    let url: string;
    if (link) {
      // every issued id is kept: a guest paying an older link (re-priced / reopened) is still found and refunded
      await cabModel(isDemo).updateOne({ _id: doc._id, status: 'AWAITING_ADVANCE_PAYMENT' }, { $set: { paymentLinkId: link.id, paymentLinkUrl: link.url }, $addToSet: { paymentLinkIds: link.id } });
      url = link.url;
    } else {
      const issued = await issueGuestLink(tenantKey, isDemo, { guestId: doc.guestId as any, guestName: doc.guestName, guestPhone: doc.guestPhone });
      url = `${issued.url}&ref=${encodeURIComponent(doc.reference)}`;
    }
    await whatsapp(isDemo, doc.guestPhone, messages.quoteAcceptedGuestMessage(doc, url, cfg.advanceWindowMin));
  } catch (err: any) {
    console.warn('[StayRide] advance request failed:', err?.message);
  }
}

// ---------------------------------------------------------------------------
// Pickup time. `date` is any instant on the chosen calendar day (IST); `time` is "hh:mm AM".
// ---------------------------------------------------------------------------
export { parseTime12 };

export function istDateTime(date: unknown, time: unknown): number | null {
  const d = Number(date);
  const mins = parseTime12(time);
  if (!Number.isFinite(d) || d <= 0 || mins === null) return null;
  const dayStart = Math.floor((d + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
  return dayStart + mins * 60000;
}

/**
 * Lazily mark open requests whose pickup was longer ago than the admin's expiry setting as EXPIRED (and their pending
 * quotes). Called by every list that shows open requests (driver, owner, admin). Idempotent.
 */
export async function expireStaleRequests(isDemo: boolean, extra: Record<string, any> = {}): Promise<number> {
  await releaseUnpaidAdvances(isDemo, extra); // same lazy hook: every list that shows requests runs it
  await expireOldQuotes(isDemo, extra);
  await autoSelectLowestQuotes(isDemo, extra);
  await checkBiddingFallbacks(isDemo, extra);
  await sendCompletionReminders(isDemo, extra);
  const cutoff = Date.now() - (await cfgOf(isDemo)).requestExpiryHours * HOUR_MS;
  const Cab = cabModel(isDemo);
  // pickupAt < date + 1 day, so anything with date >= cutoff + 1 day cannot be stale yet.
  const candidates: any[] = await Cab.find({ ...extra, status: { $in: OPEN_STATUSES }, date: { $lt: cutoff + DAY_MS } })
    .select('_id date time')
    .sort({ date: 1 })
    .limit(500)
    .lean();
  const ids = candidates.filter((d) => (istDateTime(d.date, d.time) ?? Number(d.date)) < cutoff).map((d) => d._id);
  if (!ids.length) return 0;
  const r = await Cab.updateMany(
    { _id: { $in: ids }, status: { $in: OPEN_STATUSES } },
    { $set: { status: 'EXPIRED', 'quotes.$[q].status': 'EXPIRED' } },
    { arrayFilters: [{ 'q.status': 'PENDING' }] }
  );
  return r.modifiedCount;
}

/**
 * Confirmed driver whose guest never paid in time (only when the admin set a payment window): reopen
 * the request. The unpaid driver's quote is dropped (he may quote again), the other quotes become live
 * again, and the frozen money split and driver fields are cleared. An own-fleet trip goes back to the
 * owner as a held request so they can choose again. Lazy like expiry, and one conditional update per request so a payment
 * recorded meanwhile wins (the update only matches an unpaid, AWAITING_ADVANCE_PAYMENT request).
 */
export async function releaseUnpaidAdvances(isDemo: boolean, extra: Record<string, any> = {}): Promise<number> {
  const Cab = cabModel(isDemo);
  const overdue = { status: 'AWAITING_ADVANCE_PAYMENT', advancePaid: { $ne: true }, advanceDueAt: { $lt: new Date() } };
  const docs: any[] = await Cab.find({ ...extra, ...overdue }).select('_id assignedDriverUserId').limit(100).lean();
  let released = 0;
  for (const { _id, assignedDriverUserId } of docs) {
    // Pipeline update (raw driver: Mongoose needs a flag for these): the pull and the re-open touch the same array.
    const updated: any = await Cab.collection.findOneAndUpdate({ _id, ...overdue, assignedDriverUserId }, [
      {
        $set: {
          quotes: {
            $map: {
              input: { $filter: { input: '$quotes', cond: { $ne: ['$$this.status', 'ACCEPTED'] } } },
              as: 'q',
              in: { $mergeObjects: ['$$q', { status: { $cond: [{ $eq: ['$$q.status', 'REJECTED'] }, 'PENDING', '$$q.status'] } }] },
            },
          },
        },
      },
      {
        $set: {
          status: { $cond: [{ $gt: [{ $size: '$quotes' }, 0] }, 'QUOTE_RECEIVED', 'FINDING_DRIVER'] },
          assignedDriverUserId: null,
          assignedDriverName: '',
          assignedDriverPhone: '',
          vehicleDetails: { model: '', plate: '' },
          agreedFare: 0,
          advanceAmount: 0,
          remainingCashAmount: 0,
          advanceDueAt: null,
          paymentLinkId: '',
          paymentLinkUrl: '',
          dispatched: { $cond: [{ $eq: ['$ownFleet', true] }, false, { $ifNull: ['$dispatched', true] }] },
          ownFleet: false,
          ownDriverId: null,
        },
      },
      { $unset: 'financialSnapshot' },
    ], { returnDocument: 'after' });
    if (!updated) continue; // paid, cancelled or released by someone else meanwhile
    released++;
    const msg = { title: 'Advance not paid in time', body: `Trip ${updated.reference} is open again. Choose another driver.`, data: tripData(updated, 'ADVANCE_EXPIRED') };
    await Promise.allSettled([
      pushOwner(isDemo, String(updated.propertyId), msg),
      pushUsers(isDemo, [assignedDriverUserId].filter(Boolean), { ...msg, body: `Trip ${updated.reference} was released: the guest did not pay the advance.` }),
      whatsapp(isDemo, updated.guestPhone, messages.advanceExpiredGuestMessage(updated)),
    ]);
  }
  return released;
}

/**
 * A quote older than the admin's validity stops counting (the driver may quote again). A request left
 * with no live quote goes back to "finding driver".
 */
async function expireOldQuotes(isDemo: boolean, extra: Record<string, any> = {}) {
  const hours = (await cfgOf(isDemo)).quoteValidityHours;
  if (hours <= 0) return;
  const cutoff = new Date(Date.now() - hours * HOUR_MS);
  const Cab = cabModel(isDemo);
  const filter = { ...extra, status: { $in: OPEN_STATUSES }, quotes: { $elemMatch: { status: 'PENDING', createdAt: { $lt: cutoff } } } };
  const ids = (await Cab.find(filter).select('_id').limit(200).lean()).map((d: any) => d._id);
  if (!ids.length) return;
  await Cab.updateMany(
    { _id: { $in: ids } },
    { $set: { 'quotes.$[q].status': 'EXPIRED', 'quotes.$[q].counterFare': null } },
    { arrayFilters: [{ 'q.status': 'PENDING', 'q.createdAt': { $lt: cutoff } }] }
  );
  await Cab.updateMany({ _id: { $in: ids }, status: 'QUOTE_RECEIVED', 'quotes.status': { $ne: 'PENDING' } }, { $set: { status: 'FINDING_DRIVER' } });
}

/** Quote notes must not carry a way to deal off-platform: no phone numbers, links or emails. */
export function containsContactInfo(text: string): boolean {
  return /\d{7,}/.test(text.replace(/[\s().+-]/g, '')) || /https?:\/\/|www\.|@|wa\.me|whats\s?app|telegram|t\.me/i.test(text);
}

/** Owner sends a guest inquiry to the driver network (a request that is already sent stays sent). */
export async function dispatchRequest(tenantKey: string, isDemo: boolean, reference: string) {
  const Cab = cabModel(isDemo);
  await expireStaleRequests(isDemo, { reference });
  const cfg = await cfgOf(isDemo);
  const windowMin = cfg.quoteBiddingWindowMin ?? 5;
  const biddingClosesAt = new Date(Date.now() + windowMin * 60000);
  const updated = await Cab.findOneAndUpdate(
    { reference, propertyId: tenantKey, status: { $in: OPEN_STATUSES }, dispatched: false },
    { $set: { dispatched: true, biddingClosesAt } },
    { returnDocument: 'after' }
  );
  if (updated) {
    await notifyNewRequest(isDemo, updated);
    return updated;
  }
  const doc: any = await Cab.findOne({ reference, propertyId: tenantKey }).lean();
  if (!doc) throw httpError(404, 'Trip not found');
  if (OPEN_STATUSES.includes(doc.status) && doc.dispatched !== false) return doc; // already sent
  throw conflict('This request can no longer be sent to drivers.');
}

/**
 * A tenant trip is written before its CabRequest; if the request write fails we remove the trip
 * again. If that compensation also failed, the request is left without an owner-side trip: such
 * open, unpaid requests are cancelled here so drivers never chase them. Only called with the
 * tenant's COMPLETE trip list (not for a single trip).
 */
async function cancelOrphanRequests(isDemo: boolean, tenantKey: string, refs: string[]) {
  const Cab = cabModel(isDemo);
  const filter = {
    propertyId: tenantKey,
    status: { $in: OPEN_STATUSES },
    advancePaid: { $ne: true },
    reference: { $nin: refs },
    createdAt: { $lt: new Date(Date.now() - 2 * 60000) }, // never race an in-flight creation
  };
  const orphans = await Cab.find(filter).select('_id').limit(50).lean();
  if (!orphans.length) return;
  await Cab.updateMany(
    { ...filter, _id: { $in: orphans.map((o: any) => o._id) } },
    { $set: { status: 'CANCELLED', cancellationReason: 'Request was not saved for the homestay', cancelledBy: 'system' } }
  );
}

export function parseFare(v: unknown, max = MAX_FARE): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > max) throw httpError(400, `Fare must be between ₹1 and ₹${max.toLocaleString('en-IN')}.`);
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
    driverShareOfAdvance: split.driverShareOfAdvance,
    calculatedAt: new Date(),
  };
}

async function pricedUpdate(doc: any, fare: number, isDemo: boolean) {
  // Drivers quote their net in-hand cash. System calculates platform fee + homestay commission on top.
  const split = await CommissionService.calculateGrossFromDriverCash(fare, String(doc.propertyId), isDemo);
  return {
    agreedFare: split.agreedFare,
    advanceAmount: split.advanceAmount,
    remainingCashAmount: split.remainingCashToDriver,
    financialSnapshot: snapshotFrom(split),
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
  EXPIRED: 'EXPIRED',
};

const ratingOf = (u: any) => ({
  driverRating: u?.ratingCount ? Math.round((u.ratingSum / u.ratingCount) * 10) / 10 : null,
  driverRatingCount: u?.ratingCount || 0,
});

/** `complete`: `trips` is the tenant's full trip list (enables the orphan-request sweep). */
export async function overlayTrips(tenantKey: string, isDemo: boolean, trips: any[], opts: { complete?: boolean } = {}): Promise<any[]> {
  const refs = trips.map((t) => t.reference).filter(Boolean);
  if (opts.complete) await cancelOrphanRequests(isDemo, tenantKey, refs);
  if (!refs.length) return trips.map((t) => ({ ...t, platform: false, driverRated: false }));
  await expireStaleRequests(isDemo, { propertyId: tenantKey, reference: { $in: refs } });
  const docs = await cabModel(isDemo).find({ propertyId: tenantKey, reference: { $in: refs } }).lean();
  const payoutIds = docs.map((d: any) => d.hostPayoutId).filter((id: any) => id && mongoose.Types.ObjectId.isValid(id));
  const driverIds = [...new Set(docs.flatMap((d: any) => (d.quotes || []).map((q: any) => String(q.driverId))))].filter((id) => mongoose.Types.ObjectId.isValid(id));
  const [payouts, drivers] = await Promise.all([
    payoutIds.length ? payoutModel(isDemo).find({ _id: { $in: payoutIds } }).select('status').lean() : [],
    driverIds.length ? userModel(isDemo).find({ _id: { $in: driverIds } }).select('ratingSum ratingCount').lean() : [],
  ]);
  const payoutStatus = new Map(payouts.map((p: any) => [String(p._id), p.status]));
  const driverById = new Map(drivers.map((u: any) => [String(u._id), u]));
  const byRef = new Map(docs.map((d: any) => [d.reference, d]));
  // What the owner would earn and what the guest would pay up front, per quote, before accepting it
  const rates = docs.some((d: any) => (d.quotes || []).length) ? await CommissionService.getEffectiveRates(tenantKey, isDemo) : null;
  const estimate = (fare: number) => {
    try {
      if (!rates) return {};
      const s = CommissionService.split(fare, rates.pfPercent, rates.hcPercent, rates.advancePercent, rates.minAdvanceAmount);
      return { homestayCommission: s.homestayCommissionAmount, advanceAmount: s.advanceAmount };
    } catch {
      return {};
    }
  };
  return trips.map((t) => {
    if (!t.reference) return { ...t, platform: false, driverRated: false };
    const d: any = byRef.get(t.reference);
    // The request write failed after the trip was saved (see cancelOrphanRequests): nothing is live.
    if (!d) return { ...t, platform: true, status: 'CANCELLED', cancellationReason: 'This request did not reach StayRide. Please create it again.', quotes: [], driverRated: false };
    const snap = d.financialSnapshot || null;
    const earned = d.status === 'COMPLETED' && d.advancePaid && snap ? snap.homestayCommissionAmount : 0;
    return {
      ...t,
      platform: true,
      // a guest inquiry the owner has not sent out yet is still "new" to the owner
      status: d.dispatched === false && OPEN_STATUSES.includes(d.status) ? 'NEW_REQUEST' : TRIP_STATUS[d.status] || t.status,
      dispatched: d.dispatched !== false,
      advanceDueAt: d.advanceDueAt ? new Date(d.advanceDueAt).getTime() : undefined,
      driverId: d.assignedDriverUserId || (d.ownFleet ? d.ownDriverId : null),
      driverName: d.assignedDriverName || null,
      ownerDriver: Boolean(d.ownFleet),
      fare: d.agreedFare || 0,
      advanceAmount: d.advanceAmount || 0,
      advancePaid: Boolean(d.advancePaid),
      remainingCashAmount: d.remainingCashAmount || 0,
      financialSnapshot: snap,
      commission: earned,
      commissionPaid: Boolean(d.hostPayoutId && payoutStatus.get(String(d.hostPayoutId)) === 'SETTLED'),
      payoutId: d.hostPayoutId || undefined,
      refundStatus: d.refundStatus,
      cancellationReason: ['CANCELLED', 'EXPIRED'].includes(d.status) ? d.cancellationReason || '' : t.cancellationReason,
      driverRated: Boolean(d.rating),
      needsReassignment: Boolean(d.needsReassignment),
      quotes: (d.quotes || []).map((q: any) => ({
        driverId: String(q.driverId),
        driverName: q.driverName,
        driverVehicle: q.driverVehicle,
        ...ratingOf(driverById.get(String(q.driverId))),
        quotedFare: q.quotedFare,
        counterFare: q.counterFare ?? null,
        ...estimate(q.quotedFare),
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
  const driver = isDemo && String(quote.driverId) === 'demo-driver-1'
    ? { vehicle: { plate: '' } }
    : mongoose.Types.ObjectId.isValid(String(quote.driverId))
      ? await userModel(isDemo).findOne({ _id: quote.driverId, role: 'driver', accountStatus: 'ACTIVE' }).lean()
      : null;
  if (!driver) throw conflict('This driver is no longer available.');
  // Fare comes from the driver's quote, never from the client.
  const priced = await pricedUpdate(doc, quote.quotedFare, isDemo);
  const cfg = await cfgOf(isDemo);
  const updated = await Model.findOneAndUpdate(
    {
      _id: doc._id,
      status: { $in: ['FINDING_DRIVER', 'QUOTE_RECEIVED', 'PENDING_REVIEW'] },
      dispatched: { $ne: false },
      advancePaid: { $ne: true },
      // the fare we priced must still be the driver's current quote (drivers may revise it)
      quotes: { $elemMatch: { driverId: quote.driverId, status: 'PENDING', quotedFare: quote.quotedFare } },
    },
    {
      $set: {
        ...priced,
        status: 'AWAITING_ADVANCE_PAYMENT',
        advanceDueAt: dueAt(cfg),
        paymentLinkId: '',
        paymentLinkUrl: '',
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
  if (!updated) throw conflict('This request already has a confirmed driver, or the quote changed. Refresh and try again.');
  await audit(actor, 'cab.confirm_quote', 'CabRequest', String(doc._id), { reference, driverUserId, fare: priced.agreedFare }, isDemo, scope(doc));
  // Driver: push + WhatsApp. Guest: WhatsApp with the advance to pay, but not the driver's phone yet.
  // The confirm is already committed: nothing below may fail the request.
  await Promise.allSettled([
    pushUsers(isDemo, [quote.driverId], { title: 'Your quote was accepted', body: `Trip ${reference} is yours once the advance is paid.`, data: tripData(updated, 'QUOTE_CONFIRMED') }),
    whatsapp(isDemo, quote.driverPhone, messages.quoteAcceptedDriverMessage(quote.driverName, reference)),
    requestAdvance(tenantKey, isDemo, updated),
  ]);
  return updated;
}

/**
 * One of the homestay's own drivers takes the trip. StayRide still earns: its own-fleet fee (admin
 * setting: percent of the fare, never below the minimum) is the guest's advance, paid to StayRide; the
 * rest is cash to the driver. The minimum fee keeps an under-reported fare from paying nothing.
 * Same privacy rule as nearby trips: phones are exchanged only once the advance is paid.
 */
export async function assignOwnFleet(
  tenantKey: string,
  isDemo: boolean,
  reference: string,
  driver: { id: number; name: string; phone: string; vehicle?: string; plate?: string },
  fareInput: unknown,
  actor: string
) {
  const cfg = await cfgOf(isDemo);
  const fare = parseFare(fareInput, cfg.maxFare);
  const fee = ownFleetFee(cfg, fare);
  const Model = cabModel(isDemo);
  await expireStaleRequests(isDemo, { reference });
  const doc: any = await Model.findOne({ reference, propertyId: tenantKey }).lean();
  if (!doc) throw httpError(404, 'Trip not found');
  const noFee = fee <= 0; // admin set the fee to 0: nothing to collect, the trip is confirmed at once
  const snapshot = {
    agreedFare: fare,
    advanceAmount: fee,
    advancePaid: noFee,
    platformFeeRate: cfg.ownFleetFeePercent / 100,
    platformFeeAmount: fee,
    homestayCommissionRate: 0,
    homestayCommissionAmount: 0,
    driverPayoutAmount: fare - fee,
    remainingCashToDriver: fare - fee,
    driverShareOfAdvance: 0,
    calculatedAt: new Date(),
  };
  const updated = await Model.findOneAndUpdate(
    { _id: doc._id, status: { $in: OPEN_STATUSES }, advancePaid: { $ne: true } },
    {
      $set: {
        ownFleet: true,
        ownDriverId: driver.id,
        agreedFare: fare,
        advanceAmount: fee,
        remainingCashAmount: fare - fee,
        financialSnapshot: snapshot,
        status: noFee ? 'CONFIRMED' : 'AWAITING_ADVANCE_PAYMENT',
        advancePaid: noFee,
        advanceDueAt: noFee ? null : dueAt(cfg),
        paymentLinkId: '',
        paymentLinkUrl: '',
        assignedDriverUserId: null,
        assignedDriverName: driver.name,
        assignedDriverPhone: driver.phone,
        vehicleDetails: { model: driver.vehicle || '', plate: driver.plate || '' },
        'quotes.$[p].status': 'REJECTED',
      },
    },
    { returnDocument: 'after', arrayFilters: [{ 'p.status': 'PENDING' }] }
  );
  if (!updated) throw conflict('This request already has a driver, or it is no longer open.');
  await audit(actor, 'cab.assign_own_fleet', 'CabRequest', String(doc._id), { reference, ownDriverId: driver.id, fare, fee }, isDemo, scope(doc));
  const quoted = (doc.quotes || []).filter((q: any) => q.status === 'PENDING').map((q: any) => q.driverId);
  await Promise.allSettled([
    pushUsers(isDemo, quoted, { title: 'Trip taken', body: `Trip ${reference} was given to another driver.`, data: tripData(updated, 'DRIVER_REMOVED') }),
    noFee
      ? Promise.all([
          whatsapp(isDemo, driver.phone, messages.advancePaidDriverMessage(updated, driverQuoteLink(isDemo, driver.id, updated.reference))),
          whatsapp(isDemo, updated.guestPhone, messages.advancePaidGuestMessage(updated)),
        ])
      : Promise.all([whatsapp(isDemo, driver.phone, messages.quoteAcceptedDriverMessage(driver.name, reference)), requestAdvance(tenantKey, isDemo, updated)]),
  ]);
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
    // advancePaid pinned: if admin records the payment meanwhile, this fails instead of losing the refund
    { _id: doc._id, status: { $nin: ['TRIP_STARTED', 'COMPLETED', 'CANCELLED'] }, hostPayoutId: null, advancePaid: doc.advancePaid ? true : { $ne: true } },
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
  await audit(actor, 'cab.cancel', 'CabRequest', String(doc._id), { reason, refundDue: doc.advancePaid ? doc.advanceAmount : 0 }, isDemo, scope(doc));
  const msg = { title: 'Trip cancelled', body: `Trip ${doc.reference} was cancelled.`, data: tripData(doc, 'TRIP_CANCELLED') };
  const drivers = [doc.assignedDriverUserId, ...(doc.quotes || []).filter((q: any) => q.status === 'PENDING').map((q: any) => q.driverId)].filter(Boolean);
  await Promise.allSettled([
    pushUsers(isDemo, drivers, msg),
    actor === doc.propertyId ? Promise.resolve() : pushOwner(isDemo, String(doc.propertyId), msg),
    doc.guestPhone ? whatsapp(isDemo, doc.guestPhone, messages.tripCancelledGuestMessage(updated)) : Promise.resolve(),
  ]);
  return updated;
}

// ---------------------------------------------------------------------------
// Driver actions (platform drivers approved by admin)
// ---------------------------------------------------------------------------
// Guest contact is released to the driver only once the advance is paid (booking confirmed).
const CONTACT_STATUSES = ['CONFIRMED', 'EN_ROUTE_PICKUP', 'ARRIVED_HOMESTAY', 'TRIP_STARTED', 'COMPLETED'];

/** The one shape drivers ever see for a request (open, quoted, assigned or lost). */
export function driverTripView(d: any, driverUserId: string, driverPhone?: string) {
  const cleanPhone = driverPhone ? String(driverPhone).replace(/\D/g, '').slice(-10) : '';
  const mine = (d.quotes || []).find((q: any) =>
    (driverUserId && String(q.driverId) === driverUserId) ||
    (cleanPhone && q.driverPhone && String(q.driverPhone).replace(/\D/g, '').endsWith(cleanPhone))
  );
  const assigned = Boolean(
    (driverUserId && String(d.assignedDriverUserId || '') === driverUserId) ||
    (cleanPhone && d.assignedDriverPhone && String(d.assignedDriverPhone).replace(/\D/g, '').endsWith(cleanPhone))
  );
  const driverView = assigned
    ? (d.status === 'CANCELLED' ? 'CANCELLED' : 'ASSIGNED')
    : OPEN_STATUSES.includes(d.status)
      ? (mine ? 'QUOTED' : 'OPEN')
      : (d.previousDriverUserIds || []).includes(driverUserId)
        ? 'REASSIGNED'
        : d.status === 'EXPIRED' ? 'EXPIRED' : 'CANCELLED';
  const snap = assigned ? d.financialSnapshot : null;
  const contact = assigned && CONTACT_STATUSES.includes(d.status);
  return {
    id: d.tripId ?? null,
    reference: d.reference,
    homestayName: d.homestayName,
    pickup: d.pickupLocation?.address || '',
    pickupLat: d.pickupLocation?.lat ?? null,
    pickupLng: d.pickupLocation?.lng ?? null,
    destinations: d.destinations || [],
    destination: (d.destinations || []).map((x: any) => x.address).join(' ➔ '),
    isRoundTrip: d.isRoundTrip,
    returnDate: d.returnDate,
    returnTime: d.returnTime,
    date: d.date,
    time: d.time,
    passengers: d.passengers,
    vehicleType: d.vehicleType,
    guestBudget: d.guestBudget || null,
    pickupOtpRequired: Boolean(d.pickupOtp),
    status: TRIP_STATUS[d.status] || d.status,
    driverView,
    cancellationReason: d.status === 'CANCELLED' ? d.cancellationReason || '' : null,
    myQuote: mine ? { quotedFare: mine.quotedFare, status: mine.status, notes: mine.notes || '', counterFare: mine.counterFare ?? null } : null,
    assignedToMe: assigned,
    // No guest identity / cash due before the advance is paid.
    ...(contact ? { guestName: d.guestName, phone: d.guestPhone } : {}),
    ...(assigned
      ? {
          fare: d.agreedFare,
          advanceAmount: d.advanceAmount,
          advancePaid: d.advancePaid,
          ...(d.advancePaid ? { remainingCashAmount: d.remainingCashAmount } : {}),
        }
      : {}),
    platformFeeAmount: snap ? snap.platformFeeAmount : null,
    homestayCommissionAmount: snap ? snap.homestayCommissionAmount : null,
    driverNetPayout: snap ? snap.agreedFare - snap.platformFeeAmount - snap.homestayCommissionAmount : null,
    driverSettlementStatus: assigned ? d.driverSettlementStatus || 'NONE' : 'NONE',
    driverSettlementReference: assigned && d.driverSettlementRef ? d.driverSettlementRef : null,
    driverSettledAt: assigned && d.driverSettledAt ? new Date(d.driverSettledAt).toISOString() : null,
  };
}

/** Driver's list: own/lost trips (lost ones for 7 days) + open requests when quoting is on. */
export async function listDriverTrips(isDemo: boolean, driver: any, quotesOn: boolean) {
  await expireStaleRequests(isDemo);
  const id = String(driver._id);
  const cleanPhone = driver.phone ? String(driver.phone).replace(/\D/g, '').slice(-10) : '';
  const since = new Date(Date.now() - 7 * DAY_MS);
  const phoneFilter = cleanPhone
    ? [
        { assignedDriverPhone: { $regex: `${cleanPhone}$` }, status: { $ne: 'CANCELLED' } },
        { assignedDriverPhone: { $regex: `${cleanPhone}$` }, status: 'CANCELLED', updatedAt: { $gte: since } },
        { 'quotes.driverPhone': { $regex: `${cleanPhone}$` }, status: { $in: ['CANCELLED', 'EXPIRED'] }, updatedAt: { $gte: since } },
      ]
    : [];
  const Cab = cabModel(isDemo);
  const [mine, open] = await Promise.all([
    Cab.find({
      $or: [
        { assignedDriverUserId: id, status: { $ne: 'CANCELLED' } },
        { assignedDriverUserId: id, status: 'CANCELLED', updatedAt: { $gte: since } },
        { 'quotes.driverId': id, status: { $in: ['CANCELLED', 'EXPIRED'] }, updatedAt: { $gte: since } },
        { previousDriverUserIds: id, updatedAt: { $gte: since } },
        ...phoneFilter,
      ],
    }).sort({ date: -1 }).limit(100).lean(),
    // Only requests the owner sent out, and only for this driver's vehicle class (seats), once he has set one.
    quotesOn
      ? Cab.find({ status: { $in: OPEN_STATUSES }, dispatched: { $ne: false }, ...(driver.vehicle?.type ? { vehicleType: driver.vehicle.type } : {}) })
          .sort({ date: 1 })
          .limit(200)
          .lean()
      : Promise.resolve([]),
  ]);
  // Nearby only: when both the driver and the homestay have a location, hide requests beyond the radius.
  const radius = (await cfgOf(isDemo)).nearbyRadiusKm;
  const near = (open as any[]).filter((d) => {
    const km = distanceKm(driver.location, d.homestayLocation);
    return radius <= 0 || km === null || km <= radius;
  }).slice(0, 50);
  const byRef = new Map<string, any>();
  for (const d of [...mine, ...near] as any[]) if (!byRef.has(d.reference)) byRef.set(d.reference, driverTripView(d, id, driver.phone));
  return [...byRef.values()];
}

/** A driver quotes, or revises their own quote, while the request is still open. */
export async function driverSubmitQuote(isDemo: boolean, reference: string, driver: any, fareInput: unknown, notes: unknown) {
  const cfg = await cfgOf(isDemo);
  const quotedFare = parseFare(fareInput, cfg.maxFare);
  const Model = cabModel(isDemo);
  const driverId = String(driver._id);
  const cleanNotes = typeof notes === 'string' ? notes.trim().slice(0, 300) : '';
  if (containsContactInfo(cleanNotes)) {
    throw httpError(400, 'Notes cannot contain phone numbers, links or emails. Contact details are shared once the advance is paid.');
  }
  await expireStaleRequests(isDemo, { reference });

  // Anti-gouging protection against unreasonable fares exceeding vehicle tier baselines
  const existingReq: any = await Model.findOne({ reference, status: { $in: OPEN_STATUSES }, dispatched: { $ne: false } }).select('vehicleType').lean();
  if (!existingReq) throw conflict('This request is no longer accepting quotes (or your quote was declined).');
  const estFare = (cfg.vehicles as any)?.[existingReq.vehicleType]?.estFare;
  if (estFare && estFare > 0) {
    const ceiling = Math.max(estFare * 3.5, 15000);
    if (quotedFare > ceiling) {
      throw httpError(
        400,
        `Quoted fare exceeds the maximum permissible limit for this vehicle type (₹${ceiling.toLocaleString('en-IN')}). Please submit a competitive market fare.`
      );
    }
  }
  const revise = () =>
    Model.findOneAndUpdate(
      { reference, status: { $in: OPEN_STATUSES }, dispatched: { $ne: false }, quotes: { $elemMatch: { driverId, status: { $in: ['PENDING', 'EXPIRED'] } } } },
      {
        $set: {
          'quotes.$.quotedFare': quotedFare,
          'quotes.$.notes': cleanNotes,
          'quotes.$.createdAt': new Date(),
          'quotes.$.status': 'PENDING', // an expired quote comes back to life with the new fare
          'quotes.$.counterFare': null,
          'quotes.$.counterAt': null,
          'quotes.$.driverRating': ratingOf(driver).driverRating || 0,
          status: 'QUOTE_RECEIVED',
        },
      },
      { returnDocument: 'after' }
    );
  // Each step is one conditional update: revise my pending quote, else add one (only if I have none).
  let updated = await revise();
  let isNew = false;
  if (!updated) {
    updated = await Model.findOneAndUpdate(
      { reference, status: { $in: OPEN_STATUSES }, dispatched: { $ne: false }, 'quotes.driverId': { $ne: driverId } },
      {
        $push: {
          quotes: {
            driverId,
            driverName: driver.name,
            driverPhone: driver.phone || '',
            driverVehicle: [driver.vehicle?.model, driver.vehicle?.plate].filter(Boolean).join(' ') || driver.vehicle?.type || '',
            vehicleType: driver.vehicle?.type || '',
            driverRating: ratingOf(driver).driverRating || 0,
            quotedFare,
            notes: cleanNotes,
            status: 'PENDING',
            createdAt: new Date(),
          },
        },
        $set: { status: 'QUOTE_RECEIVED' },
      },
      { returnDocument: 'after' }
    );
    isNew = Boolean(updated);
    if (!updated) updated = await revise(); // lost a race with my own parallel first quote
  }
  if (!updated) throw conflict('This request is no longer accepting quotes (or your quote was declined).');
  await pushOwner(isDemo, String(updated.propertyId), {
    title: isNew ? 'New driver quote' : 'Driver updated a quote',
    body: `₹${quotedFare.toLocaleString('en-IN')} for trip ${reference}.`,
    data: tripData(updated, 'NEW_QUOTE'),
  });
  if (cfg.quoteBiddingWindowMin === 0) {
    autoSelectLowestQuotes(isDemo, { reference }).catch(() => {});
  }
  return updated;
}

/** Great-circle distance in km, or null when either point is unknown. */
export function distanceKm(a: any, b: any): number | null {
  if (!a || !b || ![a.lat, a.lng, b.lat, b.lng].every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Drivers who should hear about a request: approved, available, same vehicle class (or none set), and
 * within the admin's radius of the homestay. Nearest first; drivers who never shared a location come
 * last so a new network is not starved. ponytail: distance computed in JS over at most 2000 drivers;
 * move to a 2dsphere index when the network is bigger.
 */
export async function matchingDrivers(isDemo: boolean, doc: any, cfg: PlatformConfig): Promise<any[]> {
  const vehicleMatch = { $or: [{ 'vehicle.type': doc.vehicleType }, { 'vehicle.type': { $in: [null, ''] } }, { 'vehicle.type': { $exists: false } }] };
  const all: any[] = await userModel(isDemo)
    .find({ role: 'driver', accountStatus: 'ACTIVE', isAvailable: { $ne: false }, ...vehicleMatch })
    .select('_id phone location whatsappAlerts')
    .limit(2000)
    .lean();
  const scored = all.map((d) => ({ d, km: distanceKm(d.location, doc.homestayLocation) }));
  return scored
    .filter((x) => cfg.nearbyRadiusKm <= 0 || x.km === null || x.km <= cfg.nearbyRadiusKm)
    .sort((x, y) => (x.km ?? Infinity) - (y.km ?? Infinity))
    .map((x) => x.d);
}

/** Tell matching drivers about a new request: push to all of them, WhatsApp to the nearest few. */
export async function notifyNewRequest(isDemo: boolean, doc: any) {
  const settings = await CommissionService.getSettings(isDemo);
  if (!CommissionService.globalFeatures(settings).driverQuotes.enabled) return;
  const cfg = CommissionService.platformConfig(settings);
  const drivers = await matchingDrivers(isDemo, doc, cfg);
  await pushUsers(isDemo, drivers.map((d) => d._id), {
    title: 'New trip request',
    body: `${doc.vehicleType || 'Cab'} from ${doc.homestayName || 'a homestay'}. Send your quote.`,
    data: tripData(doc, 'NEW_REQUEST'),
  });
  // WhatsApp too, so drivers without the app (or not looking at it) still see it. Capped: each costs money.
  // Drivers who opt out in the app (whatsappAlerts: false) only receive push notifications.
  if (isDemo || cfg.driverBroadcastMax <= 0) return;
  await Promise.allSettled(
    drivers
      .filter((d) => d.phone && d.whatsappAlerts !== false)
      .slice(0, cfg.driverBroadcastMax)
      .map((d) => whatsapp(isDemo, d.phone, messages.newRequestMessage(doc, driverQuoteLink(isDemo, d._id, doc.reference))))
  );
}

async function transition(isDemo: boolean, filter: Record<string, any>, set: Record<string, any>, notFound: string, extra: Record<string, any> = {}) {
  const updated = await cabModel(isDemo).findOneAndUpdate(filter, { $set: set, ...extra }, { returnDocument: 'after' });
  if (!updated) throw conflict(notFound);
  return updated;
}

export async function startTrip(isDemo: boolean, filter: Record<string, any>, actor: string, otp?: string) {
  // Only after the advance is paid (CONFIRMED).
  const doc: any = await cabModel(isDemo).findOne({ ...filter, status: 'CONFIRMED', advancePaid: true, needsReassignment: { $ne: true } }).lean();
  if (!doc) throw conflict('Trip can start only after the advance is paid and a driver is assigned.');

  if (doc.pickupOtp && otp && String(otp).trim() !== String(doc.pickupOtp).trim()) {
    throw httpError(400, 'Invalid Boarding Verification PIN. Please ask the passenger for their 4-digit PIN.');
  }

  const updated = await transition(
    isDemo,
    { _id: doc._id, status: 'CONFIRMED', advancePaid: true, needsReassignment: { $ne: true } },
    { status: 'TRIP_STARTED', startedAt: new Date() },
    'Trip can start only after the advance is paid and a driver is assigned.'
  );
  await audit(actor, 'cab.start', 'CabRequest', String(updated._id), {}, isDemo, scope(updated));
  await pushOwner(isDemo, String(updated.propertyId), { title: 'Trip started', body: `Trip ${updated.reference} has started.`, data: tripData(updated, 'TRIP_STARTED') });
  return updated;
}

export async function completeTrip(isDemo: boolean, filter: Record<string, any>, actor: string) {
  const doc: any = await cabModel(isDemo).findOne(filter).lean();
  if (!doc) throw httpError(404, 'Trip not found');
  const s = doc.financialSnapshot;
  const driverShare = s ? s.advanceAmount - s.platformFeeAmount - s.homestayCommissionAmount : 0;
  const updated = await transition(
    isDemo,
    { _id: doc._id, status: { $in: ['TRIP_STARTED', 'CONFIRMED'] } },
    { status: 'COMPLETED', completedAt: new Date(), driverSettlementStatus: driverShare > 0 ? 'PENDING' : 'NONE' },
    'Only a confirmed or started trip can be completed.'
  );
  await audit(actor, 'cab.complete', 'CabRequest', String(doc._id), { driverShareOfAdvance: driverShare }, isDemo, scope(updated));
  await pushOwner(isDemo, String(updated.propertyId), { title: 'Trip completed', body: `Trip ${updated.reference} is complete. Rate your driver.`, data: tripData(updated, 'TRIP_COMPLETED') });
  return updated;
}

/**
 * Automated quote auction picker:
 * Finds open requests whose bidding window (quoteBiddingWindowMin) has closed,
 * automatically selects the quote with the lowest fare, and confirms it.
 */
export async function autoSelectLowestQuotes(isDemo: boolean, extra: Record<string, any> = {}): Promise<number> {
  const Cab = cabModel(isDemo);
  const cfg = await cfgOf(isDemo);
  const now = new Date();
  const windowMin = cfg.quoteBiddingWindowMin ?? 5;
  const cutoff = new Date(now.getTime() - windowMin * 60000);
  const candidates: any[] = await Cab.find({
    ...extra,
    status: { $in: ['FINDING_DRIVER', 'QUOTE_RECEIVED'] },
    dispatched: { $ne: false },
    advancePaid: { $ne: true },
    quotes: { $elemMatch: { status: 'PENDING' } },
    $or: [
      { biddingClosesAt: { $lte: now } },
      ...(windowMin === 0 ? [{ biddingClosesAt: null }] : [{ biddingClosesAt: null, createdAt: { $lte: cutoff } }]),
    ],
  }).limit(50).lean();

  let autoSelectedCount = 0;
  for (const doc of candidates) {
    const pendingQuotes = (doc.quotes || []).filter((q: any) => q.status === 'PENDING');
    if (!pendingQuotes.length) continue;

    // Lowest quotedFare first; if tied, highest rating; if tied, earliest quote
    pendingQuotes.sort((a: any, b: any) => {
      if (a.quotedFare !== b.quotedFare) return a.quotedFare - b.quotedFare;
      if ((b.driverRating || 0) !== (a.driverRating || 0)) return (b.driverRating || 0) - (a.driverRating || 0);
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });

    const winningQuote = pendingQuotes[0];
    try {
      await ownerConfirmQuote(
        String(doc.propertyId),
        isDemo,
        doc.reference,
        String(winningQuote.driverId),
        'system:auto-lowest-bid'
      );
      await Cab.updateOne({ _id: doc._id }, { $set: { autoAccepted: true } });
      autoSelectedCount++;
    } catch (err: any) {
      console.warn(`[autoSelectLowestQuotes] Notice for ${doc.reference}:`, err?.message);
    }
  }
  return autoSelectedCount;
}

/**
 * Automated trip completion on start time:
 * Once the trip's scheduled pickup timestamp arrives/passes, a confirmed or started trip
 * is automatically completed and driver settlement share initialized.
 */
export async function autoCompleteTrips(isDemo: boolean, extra: Record<string, any> = {}): Promise<number> {
  const Cab = cabModel(isDemo);
  const now = Date.now();
  const candidates: any[] = await Cab.find({
    ...extra,
    status: { $in: ['CONFIRMED', 'TRIP_STARTED'] },
    advancePaid: true,
  }).limit(50).lean();

  let completedCount = 0;
  for (const doc of candidates) {
    const tripTimestamp = istDateTime(doc.date, doc.time) ?? Number(doc.date);
    if (tripTimestamp <= now) {
      try {
        const s = doc.financialSnapshot;
        const driverShare = s ? s.advanceAmount - s.platformFeeAmount - s.homestayCommissionAmount : 0;
        const updated = await Cab.findOneAndUpdate(
          { _id: doc._id, status: { $in: ['CONFIRMED', 'TRIP_STARTED'] }, advancePaid: true },
          {
            $set: {
              status: 'COMPLETED',
              startedAt: doc.startedAt || new Date(tripTimestamp),
              completedAt: new Date(),
              driverSettlementStatus: driverShare > 0 ? 'PENDING' : 'NONE',
              autoCompleted: true,
            },
          },
          { returnDocument: 'after' }
        );
        if (updated) {
          completedCount++;
          await audit('system:auto-complete', 'cab.complete', 'CabRequest', String(doc._id), { driverShareOfAdvance: driverShare, autoCompleted: true }, isDemo, scope(updated));
          await pushOwner(isDemo, String(updated.propertyId), {
            title: 'Trip completed',
            body: `Trip ${updated.reference} reached its scheduled time and completed. Rate your driver.`,
            data: tripData(updated, 'TRIP_COMPLETED'),
          }).catch(() => {});
        }
      } catch (err: any) {
        console.warn(`[autoCompleteTrips] Notice for ${doc.reference}:`, err?.message);
      }
    }
  }
  return completedCount;
}

/**
 * Automated bidding timeout fallback:
 * If an open dispatched request receives 0 driver quotes within the bidding window (or after 10 min),
 * alert the homestay owner via push and WhatsApp so they can assign an in-house driver or broaden the radius.
 */
export async function checkBiddingFallbacks(isDemo: boolean, extra: Record<string, any> = {}): Promise<number> {
  const Cab = cabModel(isDemo);
  const now = new Date();
  const cutoff10m = new Date(now.getTime() - 10 * 60000);

  const candidates: any[] = await Cab.find({
    ...extra,
    status: 'FINDING_DRIVER',
    dispatched: { $ne: false },
    advancePaid: { $ne: true },
    biddingFallbackAlertSentAt: null,
    $or: [
      { biddingClosesAt: { $lte: now } },
      { createdAt: { $lte: cutoff10m } },
    ],
  }).limit(20).lean();

  let alertedCount = 0;
  for (const doc of candidates) {
    const hasQuotes = (doc.quotes || []).some((q: any) => q.status === 'PENDING');
    if (hasQuotes) continue;

    const updated = await Cab.findOneAndUpdate(
      { _id: doc._id, status: 'FINDING_DRIVER', biddingFallbackAlertSentAt: null },
      { $set: { biddingFallbackAlertSentAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!updated) continue;
    alertedCount++;

    await pushOwner(isDemo, String(doc.propertyId), {
      title: 'No driver quotes yet',
      body: `No drivers quoted for trip ${doc.reference}. Tap here to assign your own driver or expand radius.`,
      data: tripData(doc, 'NO_QUOTES_FALLBACK'),
    }).catch(() => {});

    // WhatsApp alert to homestay owner if phone is available on their account
    const ownerUser: any = await userModel(isDemo).findOne({ email: doc.propertyId, role: 'owner' }).select('phone').lean();
    if (ownerUser?.phone) {
      const ownerUrl = `${config.guestWebUrl}/cab-request?ref=${encodeURIComponent(doc.reference)}`;
      await whatsapp(isDemo, ownerUser.phone, messages.biddingTimeoutOwnerMessage(doc, doc.homestayName || 'Homestay', ownerUrl)).catch(() => {});
    }

    await audit('system:bidding-fallback', 'cab.bidding_fallback', 'CabRequest', String(doc._id), { reference: doc.reference }, isDemo, scope(updated));
  }
  return alertedCount;
}

/**
 * Automated trip completion reminders:
 * Reminds drivers via WhatsApp and Push 2+ hours after scheduled pickup time to confirm
 * remaining cash collection and tap "Complete Ride" on their direct web link or app.
 */
export async function sendCompletionReminders(isDemo: boolean, extra: Record<string, any> = {}): Promise<number> {
  const Cab = cabModel(isDemo);
  const now = Date.now();
  const pickupCutoff = now - 2 * HOUR_MS;

  const candidates: any[] = await Cab.find({
    ...extra,
    status: { $in: ['CONFIRMED', 'TRIP_STARTED'] },
    advancePaid: true,
    completionReminderSentAt: null,
    assignedDriverPhone: { $exists: true, $nin: ['', null] },
  }).limit(20).lean();

  let remindedCount = 0;
  for (const doc of candidates) {
    const tripTimestamp = istDateTime(doc.date, doc.time) ?? Number(doc.date);
    if (tripTimestamp > pickupCutoff) continue; // scheduled pickup was less than 2 hours ago

    const updated = await Cab.findOneAndUpdate(
      { _id: doc._id, status: { $in: ['CONFIRMED', 'TRIP_STARTED'] }, completionReminderSentAt: null },
      { $set: { completionReminderSentAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!updated) continue;
    remindedCount++;

    const driverId = doc.assignedDriverUserId || doc.assignedDriverId;
    const directLink = driverQuoteLink(isDemo, driverId, doc.reference);

    // 1. WhatsApp to driver
    await whatsapp(isDemo, doc.assignedDriverPhone, messages.completionReminderDriverMessage(doc, directLink)).catch(() => {});

    // 2. Push to driver app (if registered)
    if (doc.assignedDriverUserId) {
      await pushUsers(isDemo, [doc.assignedDriverUserId], {
        title: 'Complete your ride',
        body: `Have you completed trip ${doc.reference}? Please confirm cash collection of ₹${doc.remainingCashAmount}.`,
        data: tripData(doc, 'COMPLETION_REMINDER'),
      }).catch(() => {});
    }

    await audit('system:completion-reminder', 'cab.completion_reminder', 'CabRequest', String(doc._id), { reference: doc.reference, driverPhone: doc.assignedDriverPhone }, isDemo, scope(updated));
  }
  return remindedCount;
}

// ---------------------------------------------------------------------------
// Negotiation: owner counter-offers a driver's quote; the driver accepts (trip confirmed at that fare)
// or simply sends a new fare. One live counter per quote.
// ---------------------------------------------------------------------------
export async function ownerCounterOffer(tenantKey: string, isDemo: boolean, reference: string, driverId: string, fareInput: unknown, actor: string) {
  const fare = parseFare(fareInput, (await cfgOf(isDemo)).maxFare);
  await expireStaleRequests(isDemo, { reference });
  const updated: any = await cabModel(isDemo).findOneAndUpdate(
    { reference, propertyId: tenantKey, status: { $in: OPEN_STATUSES }, quotes: { $elemMatch: { driverId, status: 'PENDING' } } },
    { $set: { 'quotes.$.counterFare': fare, 'quotes.$.counterAt': new Date() } },
    { returnDocument: 'after' }
  );
  if (!updated) throw conflict('This quote is no longer open. Refresh and try again.');
  const q = updated.quotes.find((x: any) => String(x.driverId) === String(driverId));
  if (fare === q.quotedFare) throw httpError(400, 'That is the driver\'s own fare: confirm the quote instead.');
  await audit(actor, 'cab.counter_offer', 'CabRequest', String(updated._id), { reference, driverId, fare, quoted: q.quotedFare }, isDemo, scope(updated));
  await Promise.allSettled([
    pushUsers(isDemo, [driverId], { title: 'Counter-offer', body: `The homestay offers ₹${fare.toLocaleString('en-IN')} for trip ${reference}.`, data: tripData(updated, 'QUOTE_COUNTER') }),
    whatsapp(isDemo, q.driverPhone, messages.quoteCounterMessage(q.driverName, reference, fare, driverQuoteLink(isDemo, driverId, reference))),
  ]);
  return updated;
}

/** Driver takes the owner's counter-offer: the quote becomes that fare and the trip is confirmed. */
export async function driverAcceptCounter(isDemo: boolean, reference: string, driver: any) {
  const driverId = String(driver._id);
  await expireStaleRequests(isDemo, { reference });
  const doc: any = await cabModel(isDemo).findOne({ reference, status: { $in: OPEN_STATUSES }, quotes: { $elemMatch: { driverId, status: 'PENDING', counterFare: { $gt: 0 } } } }).lean();
  if (!doc) throw conflict('This offer is no longer open.');
  const q = doc.quotes.find((x: any) => String(x.driverId) === driverId);
  const set = await cabModel(isDemo).findOneAndUpdate(
    { _id: doc._id, quotes: { $elemMatch: { driverId, status: 'PENDING', counterFare: q.counterFare } } },
    { $set: { 'quotes.$.quotedFare': q.counterFare, 'quotes.$.counterFare': null, 'quotes.$.notes': q.notes || '' } },
    { returnDocument: 'after' }
  );
  if (!set) throw conflict('This offer changed. Refresh and try again.');
  // The owner already agreed to this fare: confirm the trip on their behalf
  return ownerConfirmQuote(String(doc.propertyId), isDemo, reference, driverId, `driver:${driverId}:accepted-counter`);
}

/**
 * Owner closes a StayRide trip the driver forgot to mark: a started trip any time, a confirmed (paid)
 * one only once the pickup time is 3 hours past, so commission is not held up by a forgetful driver.
 */
export async function ownerCompleteTrip(tenantKey: string, isDemo: boolean, reference: string, actor: string) {
  const doc: any = await cabModel(isDemo).findOne({ reference, propertyId: tenantKey }).lean();
  if (!doc) throw httpError(404, 'Trip not found');
  if (doc.status === 'CONFIRMED') {
    const pickupAt = istDateTime(doc.date, doc.time) ?? Number(doc.date);
    if (Date.now() < pickupAt + 3 * HOUR_MS) throw conflict('You can mark it complete 3 hours after the pickup time, or once the driver starts the trip.');
    await transition(isDemo, { _id: doc._id, status: 'CONFIRMED', advancePaid: true, needsReassignment: { $ne: true } }, { status: 'TRIP_STARTED', startedAt: new Date() }, 'Only a paid trip with a driver can be completed.');
  }
  const updated = await completeTrip(isDemo, { _id: doc._id }, actor);
  await pushUsers(isDemo, [doc.assignedDriverUserId].filter(Boolean), { title: 'Trip completed', body: `The homestay marked trip ${reference} as completed.`, data: tripData(doc, 'TRIP_COMPLETED') });
  return updated;
}

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------
export async function adminAssignDriver(isDemo: boolean, id: string, body: any, actor: string) {
  const Model = cabModel(isDemo);
  const doc: any = await Model.findById(id).lean();
  if (!doc) throw httpError(404, 'Cab request not found.');
  // A paid trip whose driver was removed keeps its locked fare; only the driver changes.
  const reassign = Boolean(doc.needsReassignment);
  const cfg = await cfgOf(isDemo);
  const fare = reassign ? doc.agreedFare : parseFare(body.agreedFare, cfg.maxFare);
  let name = String(body.assignedDriverName || '').trim().slice(0, 100);
  let phone = String(body.assignedDriverPhone || '').trim().slice(0, 20);
  let driverUserId: string | null = null;
  let plate = String(body.vehiclePlate || '').slice(0, 20);
  if (body.driverUserId) {
    const driver: any = mongoose.Types.ObjectId.isValid(String(body.driverUserId))
      ? await userModel(isDemo).findOne({ _id: body.driverUserId, role: 'driver', accountStatus: 'ACTIVE' }).lean()
      : null;
    if (!driver) throw httpError(400, 'Driver not found or not approved.');
    driverUserId = String(driver._id);
    name = driver.name;
    phone = driver.phone || '';
    plate = plate || driver.vehicle?.plate || '';
  }
  if (!name || !phone) throw httpError(400, 'Driver name and phone are required.');
  const driverFields = {
    assignedDriverUserId: driverUserId,
    assignedDriverName: name,
    assignedDriverPhone: phone,
    vehicleDetails: { model: String(body.vehicleModel || doc.vehicleType || '').slice(0, 60), plate },
  };
  const previous = doc.assignedDriverUserId || null;
  let updated;
  if (reassign) {
    updated = await transition(
      isDemo,
      { _id: doc._id, needsReassignment: true, advancePaid: true, status: { $in: PAID_NOT_STARTED } },
      { ...driverFields, needsReassignment: false },
      'This trip no longer needs a new driver.'
    );
  } else {
    const priced = await pricedUpdate(doc, fare, isDemo);
    updated = await transition(
      isDemo,
      // previous assignee pinned so "reassigned away" is recorded for the right driver
      { _id: doc._id, status: { $in: [...OPEN_STATUSES, 'AWAITING_ADVANCE_PAYMENT'] }, advancePaid: { $ne: true }, assignedDriverUserId: previous },
      { ...priced, status: 'AWAITING_ADVANCE_PAYMENT', advanceDueAt: dueAt(cfg), paymentLinkId: '', paymentLinkUrl: '', ownFleet: false, ownDriverId: null, ...driverFields },
      'Request is no longer open for assignment (already paid, started, completed or cancelled).',
      previous && previous !== driverUserId ? { $addToSet: { previousDriverUserIds: previous } } : {}
    );
  }
  await audit(actor, reassign ? 'cab.reassign_driver' : 'cab.assign_driver', 'CabRequest', id, { fare, driverUserId, name }, isDemo, scope(updated));
  // Like the owner's confirm: the chosen driver's quote is accepted, everyone else's declined
  const declined = reassign
    ? []
    : (doc.quotes || []).filter((q: any) => q.status === 'PENDING' && String(q.driverId) !== String(driverUserId)).map((q: any) => q.driverId);
  if (!reassign && (doc.quotes || []).some((q: any) => q.status === 'PENDING')) {
    const mine = driverUserId ? { 'quotes.$[q].status': 'ACCEPTED' } : {};
    await Model.updateOne(
      { _id: doc._id, status: 'AWAITING_ADVANCE_PAYMENT' },
      { $set: { ...mine, 'quotes.$[o].status': 'REJECTED' } },
      { arrayFilters: [...(driverUserId ? [{ 'q.driverId': driverUserId, 'q.status': 'PENDING' }] : []), { 'o.driverId': { $ne: driverUserId }, 'o.status': 'PENDING' }] }
    );
  }
  const pushes: Promise<unknown>[] = [];
  if (driverUserId && driverUserId !== previous) {
    pushes.push(pushUsers(isDemo, [driverUserId], { title: 'New trip assigned', body: `StayRide assigned you trip ${doc.reference}.`, data: tripData(doc, 'TRIP_ASSIGNED') }));
  }
  if (previous && previous !== driverUserId) {
    pushes.push(pushUsers(isDemo, [previous], { title: 'Trip reassigned', body: `Trip ${doc.reference} was given to another driver.`, data: tripData(doc, 'DRIVER_REMOVED') }));
  }
  if (declined.length) pushes.push(pushUsers(isDemo, declined, { title: 'Trip taken', body: `Trip ${doc.reference} was given to another driver.`, data: tripData(doc, 'DRIVER_REMOVED') }));
  if (reassign) {
    // Advance already paid: the new driver and the guest get each other's details now, the owner is told
    pushes.push(
      whatsapp(isDemo, phone, messages.advancePaidDriverMessage(updated, driverQuoteLink(isDemo, updated.assignedDriverUserId, updated.reference))),
      whatsapp(isDemo, updated.guestPhone, messages.advancePaidGuestMessage(updated)),
      pushOwner(isDemo, String(doc.propertyId), { title: 'New driver assigned', body: `StayRide assigned ${name} to trip ${doc.reference}.`, data: tripData(updated, 'TRIP_ASSIGNED') })
    );
  } else {
    // A new fare means a new advance: give the guest a way to pay it; WhatsApp-only drivers hear it too
    pushes.push(whatsapp(isDemo, phone, messages.quoteAcceptedDriverMessage(name, doc.reference)), requestAdvance(String(doc.propertyId), isDemo, updated));
  }
  await Promise.allSettled(pushes);
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
  // Exactly the advance: the rest is cash to the driver, and refunds/ledgers assume this amount.
  const paid = Number(body.amount);
  if (!Number.isFinite(paid) || paid !== doc.advanceAmount) {
    throw httpError(400, `Amount must equal the advance of ₹${doc.advanceAmount}. Record only the advance; the balance is paid to the driver in cash.`);
  }
  return applyAdvancePayment(isDemo, doc, { transactionId, method: body.method, amount: paid, note: String(body.note || ''), actor });
}

/**
 * The one way an advance becomes paid (admin by hand, or the gateway webhook): CONFIRMED, phones released.
 * Conditional on the request still waiting for exactly this amount, so a release, cancel or second
 * payment in between makes it fail instead of double-applying.
 */
async function applyAdvancePayment(isDemo: boolean, doc: any, p: { transactionId: string; method: string; amount: number; note: string; actor: string }) {
  const Model = cabModel(isDemo);
  if (await Model.exists({ advancePaymentId: p.transactionId })) throw conflict('This transaction ID is already recorded on another request.');
  const pickupOtp = doc.pickupOtp || String(Math.floor(1000 + Math.random() * 9000));
  let updated;
  try {
    updated = await transition(
      isDemo,
      { _id: doc._id, status: 'AWAITING_ADVANCE_PAYMENT', advancePaid: { $ne: true }, advanceAmount: p.amount },
      {
        advancePaid: true,
        pickupOtp,
        'financialSnapshot.advancePaid': true,
        advancePaymentId: p.transactionId,
        advancePaymentMethod: p.method,
        paymentRecordedBy: p.actor,
        paymentRecordedAt: new Date(),
        paymentNote: p.note.slice(0, 500),
        advanceDueAt: null,
        status: 'CONFIRMED',
      },
      'Request is not awaiting an advance payment.'
    );
  } catch (err: any) {
    if (err?.code === 11000) throw conflict('This transaction ID is already recorded on another request.');
    throw err;
  }
  const id = String(doc._id);
  await audit(p.actor, 'payment.record', 'CabRequest', id, { transactionId: p.transactionId, amount: p.amount, method: p.method }, isDemo, scope(updated));
  const msg = { title: 'Advance received', body: `Trip ${doc.reference} is confirmed.`, data: tripData(doc, 'ADVANCE_PAID') };
  const commission = updated.financialSnapshot?.homestayCommissionAmount;
  const ownerMsg = { ...msg, body: `Trip ${doc.reference} is confirmed.${commission ? ` Your commission of ₹${commission.toLocaleString('en-IN')} is updated.` : ''}` };
  // Now the phones are released: driver gets the guest's details, guest gets the driver's.
  await Promise.allSettled([
    pushUsers(isDemo, [updated.assignedDriverUserId].filter(Boolean), msg),
    pushOwner(isDemo, String(doc.propertyId), ownerMsg),
    whatsapp(isDemo, updated.assignedDriverPhone, messages.advancePaidDriverMessage(updated, driverQuoteLink(isDemo, updated.assignedDriverUserId, updated.reference))),
    whatsapp(isDemo, updated.guestPhone, messages.advancePaidGuestMessage(updated)),
  ]);
  return updated;
}

/**
 * Razorpay says a payment link was paid (signature already verified). Records the advance; if the
 * request is no longer waiting for it (released, cancelled, other amount, already paid by hand) the
 * money is kept on the request as an unmatched payment for the admin to refund. Idempotent: Razorpay
 * retries webhooks, and the same payment id is never applied or listed twice.
 */
export async function recordGatewayPayment(linkId: string, paymentId: string, amountRupees: number): Promise<'RECORDED' | 'UNMATCHED' | 'DUPLICATE' | 'UNKNOWN'> {
  const isDemo = false; // the gateway is never used for demo tenants
  const Model = cabModel(isDemo);
  if (!linkId || !paymentId) return 'UNKNOWN';
  const doc: any = await Model.findOne({ $or: [{ paymentLinkId: linkId }, { paymentLinkIds: linkId }, { 'unmatchedPayments.paymentId': paymentId }, { advancePaymentId: paymentId }] }).lean();
  if (!doc) return 'UNKNOWN';
  if (doc.advancePaymentId === paymentId || (doc.unmatchedPayments || []).some((u: any) => u.paymentId === paymentId)) return 'DUPLICATE';
  if (doc.paymentLinkId === linkId && doc.status === 'AWAITING_ADVANCE_PAYMENT' && !doc.advancePaid && amountRupees === doc.advanceAmount) {
    try {
      await applyAdvancePayment(isDemo, doc, { transactionId: paymentId, method: 'GATEWAY', amount: amountRupees, note: `Razorpay ${linkId}`, actor: 'razorpay' });
      return 'RECORDED';
    } catch (err: any) {
      if (err?.status !== 409) throw err; // state changed meanwhile: fall through to unmatched
    }
  }
  await Model.updateOne(
    { _id: doc._id, 'unmatchedPayments.paymentId': { $ne: paymentId } },
    { $push: { unmatchedPayments: { paymentId, amount: amountRupees, status: doc.status, at: new Date() } } }
  );
  await audit('razorpay', 'payment.unmatched', 'CabRequest', String(doc._id), { paymentId, linkId, amount: amountRupees, status: doc.status }, isDemo, scope(doc));
  return 'UNMATCHED';
}

/** Undo a wrongly recorded payment. Only before the trip starts and before any payout. */
export async function adminVoidPayment(isDemo: boolean, id: string, reason: unknown, actor: string) {
  const why = String(reason || '').trim().slice(0, 300);
  if (!why) throw httpError(400, 'A reason is required to void a payment.');
  const Model = cabModel(isDemo);
  const doc: any = await Model.findById(id).lean();
  if (!doc) throw httpError(404, 'Cab request not found.');
  const cfg = await cfgOf(isDemo);
  const updated = await Model.findOneAndUpdate(
    // a paid trip waiting for a new driver keeps its payment: assign a driver (or cancel) first
    { _id: doc._id, status: 'CONFIRMED', advancePaid: true, hostPayoutId: null, needsReassignment: { $ne: true } },
    {
      $set: {
        advancePaid: false,
        'financialSnapshot.advancePaid': false,
        advancePaymentId: '',
        advancePaymentMethod: '',
        status: 'AWAITING_ADVANCE_PAYMENT',
        advanceDueAt: dueAt(cfg),
        paymentLinkId: '',
        paymentLinkUrl: '',
      },
      $push: {
        voidedPayments: { transactionId: doc.advancePaymentId, amount: doc.advanceAmount, method: doc.advancePaymentMethod, reason: why, voidedBy: actor, at: new Date() },
      },
    },
    { returnDocument: 'after' }
  );
  if (!updated) throw conflict('Only a confirmed, not-yet-started payment can be voided (a trip waiting for a new driver needs one first).');
  await audit(actor, 'payment.void', 'CabRequest', id, { transactionId: doc.advancePaymentId, reason: why }, isDemo, scope(updated));
  const msg = { title: 'Advance not received', body: `The advance for trip ${doc.reference} was not received. The trip waits for payment again.`, data: tripData(updated, 'ADVANCE_VOIDED') };
  await Promise.allSettled([
    pushOwner(isDemo, String(doc.propertyId), msg),
    pushUsers(isDemo, [updated.assignedDriverUserId].filter(Boolean), msg),
    requestAdvance(String(doc.propertyId), isDemo, updated),
  ]);
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
  await audit(actor, 'payment.refund', 'CabRequest', id, { reference: ref, amount: updated.advanceAmount }, isDemo, scope(updated));
  if (updated.guestPhone) await whatsapp(isDemo, updated.guestPhone, messages.refundGuestMessage(updated, ref)).catch(() => {});
  return updated;
}

/** 2. A gateway payment that matched nothing (paid twice, old link, after a cancel): refunded in Razorpay, then closed here. */
export async function adminRefundUnmatched(isDemo: boolean, id: string, paymentId: unknown, reference: unknown, actor: string) {
  const pid = String(paymentId || '').trim();
  const ref = String(reference || '').trim().slice(0, 100);
  if (!pid) throw httpError(400, 'Payment id is required.');
  if (!ref) throw httpError(400, 'Refund reference is required.');
  const updated = await transition(
    isDemo,
    { _id: id, unmatchedPayments: { $elemMatch: { paymentId: pid, refundedAt: null } } },
    { 'unmatchedPayments.$.refundedAt': new Date(), 'unmatchedPayments.$.refundReference': ref },
    'No open unmatched payment with this id on this request.'
  );
  const amount = (updated.unmatchedPayments || []).find((u: any) => u.paymentId === pid)?.amount;
  await audit(actor, 'payment.unmatched_refund', 'CabRequest', id, { paymentId: pid, reference: ref, amount }, isDemo, scope(updated));
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
  await audit(actor, 'driver.settle', 'CabRequest', id, { reference: ref }, isDemo, scope(updated));
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

/**
 * Self-heal: trips locked to a REJECTED (or vanished) payout are released. Rejecting unlocks its
 * trips right away, but if that step was interrupted they would stay locked forever.
 */
export async function releaseStaleLocks(isDemo: boolean, tenantKey: string) {
  const Cab = cabModel(isDemo);
  const lockedTo: string[] = (await Cab.distinct('hostPayoutId', { propertyId: tenantKey, hostPayoutId: { $ne: null } })).map(String);
  if (!lockedTo.length) return;
  const live = await payoutModel(isDemo)
    .find({ _id: { $in: lockedTo.filter((x) => mongoose.Types.ObjectId.isValid(x)) }, status: { $ne: 'REJECTED' } })
    .select('_id')
    .lean();
  const liveIds = new Set(live.map((p: any) => String(p._id)));
  const dead = lockedTo.filter((x) => !liveIds.has(x));
  if (dead.length) await Cab.updateMany({ propertyId: tenantKey, hostPayoutId: { $in: dead } }, { $set: { hostPayoutId: null } });
}

export async function payoutSummary(tenantKey: string, isDemo: boolean) {
  await releaseStaleLocks(isDemo, tenantKey);
  const [eligible, pending] = await Promise.all([
    cabModel(isDemo).find(eligibleFilter(tenantKey)).select('financialSnapshot.homestayCommissionAmount').lean(),
    payoutModel(isDemo).findOne({ tenantId: tenantKey, status: 'PENDING' }).lean(),
  ]);
  const available = eligible.reduce((a: number, d: any) => a + d.financialSnapshot.homestayCommissionAmount, 0);
  return { available, eligibleTrips: eligible.length, pendingPayout: pending ? { id: String((pending as any)._id), amount: (pending as any).amount } : null };
}

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function parsePayoutMethod(body: any) {
  const method = body.method ?? body.payoutMethod ?? 'UPI';
  if (method !== 'UPI' && method !== 'BANK_TRANSFER') throw httpError(400, "Payout method must be 'UPI' or 'BANK_TRANSFER'.");
  if (method === 'UPI') {
    const upiId = typeof body.upiId === 'string' ? body.upiId.trim().slice(0, 100) : '';
    if (!/^[\w.\-]{2,}@[\w]{2,}$/.test(upiId)) throw httpError(400, 'A valid UPI ID (e.g. yourname@okhdfcbank) is required.');
    return { method, upiId, bank: undefined };
  }
  const b = body.bank;
  if (!b || typeof b !== 'object') throw httpError(400, 'Bank details are required for a bank transfer.');
  const accountName = typeof b.accountName === 'string' ? b.accountName.trim() : '';
  const accountNumber = typeof b.accountNumber === 'string' ? b.accountNumber.replace(/\s/g, '') : '';
  const ifsc = typeof b.ifsc === 'string' ? b.ifsc.trim().toUpperCase() : '';
  const bankName = typeof b.bankName === 'string' ? b.bankName.trim() : '';
  if (!accountName || accountName.length > 100) throw httpError(400, 'Account holder name is required (max 100 characters).');
  if (!/^\d{9,18}$/.test(accountNumber)) throw httpError(400, 'Account number must be 9 to 18 digits.');
  if (!IFSC.test(ifsc)) throw httpError(400, 'Enter a valid IFSC code (e.g. HDFC0001234).');
  if (b.bankName !== undefined && (typeof b.bankName !== 'string' || bankName.length > 100)) throw httpError(400, 'Bank name must be text (max 100 characters).');
  return { method, upiId: undefined, bank: { accountName, accountNumber, ifsc, ...(bankName ? { bankName } : {}) } };
}

/** Owner-facing payout: account number masked to the last 4 digits. Handles legacy field names. */
export function ownerPayoutView(p: any) {
  const legacy = p.bankDetails;
  const bank = p.bank || (legacy ? { accountName: legacy.accountHolderName, accountNumber: legacy.accountNumber, ifsc: legacy.ifscCode, bankName: legacy.bankName } : undefined);
  const { bankDetails, payoutMethod, ...rest } = p;
  return {
    ...rest,
    method: p.method || payoutMethod || 'UPI',
    ...(bank ? { bank: { ...bank, accountNumber: `****${String(bank.accountNumber || '').slice(-4)}` } } : {}),
  };
}

export async function requestPayout(tenantKey: string, isDemo: boolean, owner: { name: string; phone: string; homestayName: string }, body: any, actor: string) {
  const { method, upiId, bank } = parsePayoutMethod(body);

  const Cab = cabModel(isDemo);
  const Payout = payoutModel(isDemo);
  await releaseStaleLocks(isDemo, tenantKey);
  const pending: any = await Payout.findOne({ tenantId: tenantKey, status: 'PENDING' }).lean();
  if (pending) {
    // Self-heal a request whose lock step never ran (e.g. function timed out): no trips locked → remove it.
    const lockedCount = await Cab.countDocuments({ hostPayoutId: String(pending._id) });
    const ageMs = Date.now() - new Date(pending.requestedAt).getTime();
    if (lockedCount === 0 && ageMs > 60_000) {
      await Payout.deleteOne({ _id: pending._id, status: 'PENDING' });
      await audit('system', 'payout.orphan_removed', 'PayoutRequest', String(pending._id), { tenantKey }, isDemo);
    } else {
      throw conflict('You already have a payout request pending.');
    }
  }
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
      method,
      upiId: method === 'UPI' ? upiId : undefined,
      bank: method === 'BANK_TRANSFER' ? bank : undefined,
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
  await pushOwner(isDemo, payout.tenantId, { title: 'Payout sent', body: `₹${payout.amount.toLocaleString('en-IN')} was paid out (UTR ${utr}).`, data: { type: 'PAYOUT_SETTLED' } });
  return updated;
}

export async function rejectPayout(isDemo: boolean, id: string, reason: unknown, actor: string) {
  const why = String(reason || '').trim().slice(0, 300);
  if (!why) throw httpError(400, 'A reason is required.');
  const Payout = payoutModel(isDemo);
  const unlock = () => cabModel(isDemo).updateMany({ hostPayoutId: String(id) }, { $set: { hostPayoutId: null } });
  const updated: any = await Payout.findOneAndUpdate(
    { _id: id, status: 'PENDING' },
    { $set: { status: 'REJECTED', rejectedReason: why, decidedBy: actor, settledAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!updated) {
    // Retry of an interrupted reject: make sure its trips are unlocked, then report the state.
    if ((await Payout.exists({ _id: id, status: 'REJECTED' }))) await unlock();
    throw conflict('Payout is not pending.');
  }
  // Unlock its trips so they can be requested again (idempotent; payoutSummary/requestPayout also heal).
  await unlock();
  await audit(actor, 'payout.reject', 'PayoutRequest', id, { reason: why, amount: updated.amount }, isDemo, { tenantId: String(updated.tenantId) });
  await pushOwner(isDemo, updated.tenantId, { title: 'Payout request rejected', body: why, data: { type: 'PAYOUT_REJECTED' } });
  return updated;
}

// ---------------------------------------------------------------------------
// Driver ratings (owner rates the platform driver once per completed trip)
// ---------------------------------------------------------------------------
export async function rateDriver(tenantKey: string, isDemo: boolean, reference: string, body: any, actor: string) {
  const stars = body?.stars;
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw httpError(400, 'Stars must be a whole number from 1 to 5.');
  const raw = body?.comment ?? '';
  if (typeof raw !== 'string' || raw.trim().length > 300) throw httpError(400, 'Comment must be text of at most 300 characters.');
  const comment = raw.trim();
  // `rating: null` makes this a once-only transition (concurrent/retried calls cannot double count).
  const updated: any = await cabModel(isDemo).findOneAndUpdate(
    { reference, propertyId: tenantKey, status: 'COMPLETED', assignedDriverUserId: { $nin: [null, ''] }, rating: null },
    { $set: { rating: { stars, comment, ratedAt: new Date(), ratedBy: actor } } },
    { returnDocument: 'after' }
  );
  if (!updated) throw conflict('Only a completed StayRide trip can be rated, and only once.');
  // ponytail: two writes; a crash between them loses one rating from the average (the trip stays rated).
  if (mongoose.Types.ObjectId.isValid(updated.assignedDriverUserId)) {
    await userModel(isDemo).updateOne({ _id: updated.assignedDriverUserId, role: 'driver' }, { $inc: { ratingSum: stars, ratingCount: 1 } });
  }
  await audit(actor, 'cab.rate_driver', 'CabRequest', String(updated._id), { stars, driverUserId: updated.assignedDriverUserId }, isDemo, scope(updated));
  return updated;
}

/**
 * Passenger / Guest driver rating:
 * Allows the passenger on the web interface to submit a 1-5 star review and comment after the ride completes.
 * Updates the driver's platform reputation and stores the guest review on the cab request.
 */
export async function rateDriverByGuest(isDemo: boolean, reference: string, body: any) {
  const stars = body?.stars;
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw httpError(400, 'Stars must be a whole number from 1 to 5.');
  const raw = body?.comment ?? '';
  if (typeof raw !== 'string' || raw.trim().length > 300) throw httpError(400, 'Comment must be text of at most 300 characters.');
  const comment = raw.trim();

  const Cab = cabModel(isDemo);
  const doc: any = await Cab.findOne({ reference, status: 'COMPLETED', assignedDriverUserId: { $nin: [null, ''] } }).lean();
  if (!doc) throw httpError(404, 'Only a completed trip with an assigned driver can be rated.');
  if (doc.guestRating) throw conflict('You have already rated this trip.');

  const updateSet: any = {
    guestRating: { stars, comment, ratedAt: new Date() },
  };
  if (!doc.rating) {
    updateSet.rating = { stars, comment, ratedAt: new Date(), ratedBy: `guest:${doc.guestPhone || 'passenger'}` };
  }

  const updated: any = await Cab.findOneAndUpdate(
    { reference, status: 'COMPLETED', guestRating: null },
    { $set: updateSet },
    { returnDocument: 'after' }
  );
  if (!updated) throw conflict('You have already rated this trip.');

  if (mongoose.Types.ObjectId.isValid(updated.assignedDriverUserId)) {
    await userModel(isDemo).updateOne({ _id: updated.assignedDriverUserId, role: 'driver' }, { $inc: { ratingSum: stars, ratingCount: 1 } });
  }
  await audit('guest', 'cab.rate_driver_by_guest', 'CabRequest', String(updated._id), { stars, comment, driverUserId: updated.assignedDriverUserId }, isDemo, scope(updated));
  return updated;
}

/** Driver list rating fields (average to 1 decimal, null when unrated). */
export const driverRatingFields = (u: any) => ({ rating: ratingOf(u).driverRating, ratingCount: ratingOf(u).driverRatingCount });

// ---------------------------------------------------------------------------
// Driver account status changes (admin). Call after the status is saved.
// ---------------------------------------------------------------------------
export async function onDriverStatusChange(isDemo: boolean, driverUserId: string, status: string, actor: string) {
  // A driver who can't use the app any more (pending review or blocked) can't keep trips either
  if (status === 'BLOCKED') await releaseDriverTrips(isDemo, driverUserId, actor, 'Your StayRide driver account was blocked. Contact StayRide support.');
  if (status === 'PENDING_APPROVAL') await releaseDriverTrips(isDemo, driverUserId, actor, 'Your StayRide driver account is under review again. Your upcoming trips were given back to StayRide.');
  if (status === 'ACTIVE') {
    await pushUsers(isDemo, [driverUserId], { title: 'You are approved', body: 'Your StayRide driver account is active. You can now quote on trips.', data: { type: 'DRIVER_APPROVED' } });
  }
}

/**
 * A blocked driver's not-yet-started trips are released:
 *  - pending quotes on open requests are declined;
 *  - advance not paid: assignment and fare cleared, the request reopens for quotes;
 *  - advance paid: driver cleared, needsReassignment=true; admin assigns a new driver at the locked fare.
 */
export async function releaseDriverTrips(isDemo: boolean, driverUserId: string, actor: string, notice: string | null = null) {
  const Cab = cabModel(isDemo);
  const id = String(driverUserId);
  const noDriver = { assignedDriverUserId: null, assignedDriverName: '', assignedDriverPhone: '', vehicleDetails: { model: '', plate: '' } };
  const removedMsg = (d: any) => ({ title: 'Driver removed', body: `The driver for trip ${d.reference} is no longer available. StayRide will arrange another.`, data: tripData(d, 'DRIVER_REMOVED') });

  await Cab.updateMany(
    { status: { $in: OPEN_STATUSES }, quotes: { $elemMatch: { driverId: id, status: 'PENDING' } } },
    { $set: { 'quotes.$[q].status': 'REJECTED' } },
    { arrayFilters: [{ 'q.driverId': id, 'q.status': 'PENDING' }] }
  );

  const released: any[] = [];
  const unpaid: any[] = await Cab.find({ assignedDriverUserId: id, status: 'AWAITING_ADVANCE_PAYMENT', advancePaid: { $ne: true } }).lean();
  for (const d of unpaid) {
    // Other drivers' quotes come back for the owner to choose from, if those drivers are still active.
    const others = (d.quotes || []).map((q: any) => String(q.driverId)).filter((x: string) => x !== id && mongoose.Types.ObjectId.isValid(x));
    const active = new Set((others.length ? await userModel(isDemo).find({ _id: { $in: others }, role: 'driver', accountStatus: 'ACTIVE' }).select('_id').lean() : []).map((u: any) => String(u._id)));
    const quotes = (d.quotes || []).map((q: any) => ({ ...q, status: active.has(String(q.driverId)) && q.status !== 'EXPIRED' ? 'PENDING' : q.status === 'EXPIRED' ? 'EXPIRED' : 'REJECTED' }));
    const updated = await Cab.findOneAndUpdate(
      { _id: d._id, assignedDriverUserId: id, status: 'AWAITING_ADVANCE_PAYMENT', advancePaid: { $ne: true } },
      {
        $set: {
          ...noDriver,
          status: quotes.some((q: any) => q.status === 'PENDING') ? 'QUOTE_RECEIVED' : 'FINDING_DRIVER',
          quotes,
          agreedFare: 0,
          advanceAmount: 0,
          remainingCashAmount: 0,
          financialSnapshot: null,
          advanceDueAt: null,
          paymentLinkId: '',
          paymentLinkUrl: '',
        },
        $addToSet: { previousDriverUserIds: id },
      },
      { returnDocument: 'after' }
    );
    if (updated) released.push(updated);
  }

  const paid: any[] = await Cab.find({ assignedDriverUserId: id, advancePaid: true, status: { $in: PAID_NOT_STARTED } }).select('_id').lean();
  if (paid.length) {
    await Cab.updateMany(
      { _id: { $in: paid.map((d) => d._id) }, assignedDriverUserId: id, advancePaid: true, status: { $in: PAID_NOT_STARTED } },
      { $set: { ...noDriver, needsReassignment: true }, $addToSet: { previousDriverUserIds: id } }
    );
    released.push(...(await Cab.find({ _id: { $in: paid.map((d) => d._id) }, needsReassignment: true }).lean()));
  }
  if (notice) await pushUsers(isDemo, [id], { title: 'Driver account update', body: notice, data: { type: 'DRIVER_BLOCKED' } });
  if (!released.length) return;
  await audit(actor, 'driver.trips_released', 'User', id, { references: released.map((d) => d.reference) }, isDemo, { driverId: id });
  await Promise.all(released.map((d) => pushOwner(isDemo, String(d.propertyId), removedMsg(d))));
}
