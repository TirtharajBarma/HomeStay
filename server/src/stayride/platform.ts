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
import { sendWhatsApp, WhatsAppMessage, WhatsAppResult, WhatsAppContext, maskPhone } from '../services/whatsapp.service.js';
import * as messages from './messages.js';
import { parseTime12 } from './time.js';
import { getCabRequestModel } from '../models/cab-request.model.js';
import { getPayoutRequestModel } from '../models/payout-request.model.js';
import { User } from '../models/user.model.js';
import { Driver } from '../models/driver.model.js';
import { audit } from '../models/audit-log.model.js';
import { CommissionService } from '../services/commission.service.js';
import { logger } from '../utils/logger.js';
import { httpError } from '../middlewares/error-handler.js';
import { tenantDbModel } from '../utils/tenant-model.js';
import { notify, PushMessage } from '../services/push.service.js';
import { createPaymentLink, cancelPaymentLink, gatewayEnabled } from '../services/payment-gateway.service.js';
import { PlatformConfig, ownFleetFee } from '../services/platform-config.js';
import { tenantManager } from './store.js';

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
export const scope = (d: any) => ({ tenantId: String(d?.propertyId || ''), driverId: String(d?.assignedDriverUserId || '') });

export function userModel(isDemo = false): mongoose.Model<any> {
  // Demo users live only in "test", everyone else only in "production"; never fall back to the
  // default connection (which points at production) when the DB is not ready.
  return tenantDbModel(isDemo, 'User', User.schema);
}

export function driverModel(isDemo = false): mongoose.Model<any> {
  return tenantDbModel(isDemo, 'Driver', Driver.schema);
}

const conflict = (message: string) => httpError(409, message, 'INVALID_STATE');

export { maskPhone };

// A driver holds these trips; he can't win another whose pickup is too close.
const HELD_STATUSES = ['AWAITING_ADVANCE_PAYMENT', 'CONFIRMED', 'EN_ROUTE_PICKUP', 'ARRIVED_HOMESTAY', 'TRIP_STARTED'];
// ponytail: fixed 3h window around pickup is the ceiling; a longer trip (full-day tour) can still overlap. Use trip duration once it is known.
export const OVERLAP_MS = 3 * HOUR_MS;
export const pickupsOverlap = (a: number | null, b: number | null) => a !== null && b !== null && Math.abs(a - b) < OVERLAP_MS;

/** Driver id a quote link is bound to: platform user id, or `own-<id>` for a homestay's own driver. */
export const linkDriverId = (d: any) => d.assignedDriverUserId || (d.ownFleet && d.ownDriverId != null ? `own-${d.ownDriverId}` : '');
/** Trips a quote-link driver may act on (start / complete / vehicle), own-fleet ones included. */
export const linkDriverFilter = (driverId: string) =>
  driverId.startsWith('own-')
    ? { $or: [{ assignedDriverUserId: driverId }, { ownFleet: true, ownDriverId: Number(driverId.slice(4)) }] }
    : { assignedDriverUserId: driverId };

export const pushOwner = (isDemo: boolean, tenantKey: string, msg: PushMessage) => notify(isDemo, { email: tenantKey, role: 'owner' }, msg);
const pushUsers = (isDemo: boolean, ids: unknown[], msg: PushMessage) => {
  const valid = [...new Set(ids.map(String))].filter((id) => mongoose.Types.ObjectId.isValid(id));
  return valid.length ? notify(isDemo, { _id: { $in: valid } }, msg) : Promise.resolve();
};
const tripData = (d: any, type: string) => ({ type, reference: d.reference, ...(typeof d.tripId === 'number' ? { tripId: d.tripId } : {}) });

/** WhatsApp from the company number. Every message is also pushed to the app where the person has it. */
/** `ctx` adds to the builder's own context (trip ref / tenant / driver) for logs and status webhooks. */
export const whatsapp = async (isDemo: boolean, to: unknown, built: Omit<WhatsAppMessage, 'to'>, ctx?: WhatsAppContext): Promise<WhatsAppResult> => {
  const cfg = await cfgOf(isDemo);
  return sendWhatsApp(isDemo, { ...built, to: String(to ?? ''), context: { ...built.context, ...ctx } }, cfg.whatsappLanguage, cfg.whatsappTemplates[built.event]);
};

/** Trip confirmation, then the boarding PIN as its own message (in that order). */
const confirmGuestWhatsApp = async (isDemo: boolean, doc: any): Promise<WhatsAppResult> => {
  const result = await whatsapp(isDemo, doc.guestPhone, messages.advancePaidGuestMessage(doc));
  return doc.pickupOtp ? whatsapp(isDemo, doc.guestPhone, messages.boardingPinGuestMessage(String(doc.pickupOtp)), { ref: doc.reference, ...scope(doc) }) : result;
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

  const result = await whatsapp(isDemo, guest.guestPhone, msg, { tenantId: tenantKey });
  if (result === 'SENT') await Links.updateOne({ _id: link.id }, { $set: { sentAt: new Date() } });
  return { result, expiresAt: link.expiresAt, url: link.url };
}

const dueAt = (cfg: PlatformConfig) => (cfg.advanceWindowMin > 0 ? new Date(Date.now() + cfg.advanceWindowMin * 60000) : null);

/** Ids (of `ids`) whose platform driver account exists but is not ACTIVE (blocked / under review). */
async function inactiveDrivers(isDemo: boolean, ids: unknown[]): Promise<Set<string>> {
  const valid = [...new Set(ids.map(String))].filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!valid.length) return new Set();
  const users = await userModel(isDemo).find({ _id: { $in: valid }, role: 'driver', accountStatus: { $ne: 'ACTIVE' } }).select('_id').lean();
  return new Set(users.map((u: any) => String(u._id)));
}

/** True when the driver already holds another trip whose pickup is within OVERLAP_MS of this one. */
async function driverHasOverlap(isDemo: boolean, driverId: string, doc: any): Promise<boolean> {
  const at = istDateTime(doc.date, doc.time) ?? Number(doc.date);
  const held: any[] = await cabModel(isDemo)
    .find({ _id: { $ne: doc._id }, assignedDriverUserId: driverId, status: { $in: HELD_STATUSES }, date: { $gt: at - 2 * DAY_MS, $lt: at + 2 * DAY_MS } })
    .select('date time')
    .lean();
  return held.some((t) => pickupsOverlap(at, istDateTime(t.date, t.time) ?? Number(t.date)));
}

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
          description: `Cab advance for trip ${doc.reference}`,
          expiresAt: doc.advanceDueAt ? new Date(doc.advanceDueAt) : null,
        });
    if (!isDemo && gatewayEnabled() && !link) {
      throw new Error('Razorpay is enabled but could not create the required payment link.');
    }
    let url: string;
    if (link) {
      // every issued id is kept: a guest paying an older link (re-priced / reopened) is still found and refunded.
      // Only onto a request still without a link: if a retry got there first (or it was paid / cancelled), ours is dropped.
      const set = await cabModel(isDemo).updateOne(
        { _id: doc._id, status: 'AWAITING_ADVANCE_PAYMENT', paymentLinkId: { $in: ['', null] } },
        { $set: { paymentLinkId: link.id, paymentLinkUrl: link.url }, $addToSet: { paymentLinkIds: link.id } }
      );
      if (!set.matchedCount) {
        await cancelPaymentLink(link.id);
        return;
      }
      // the trip's earlier links carry an old amount: the guest must not be able to pay them any more
      await Promise.allSettled((doc.paymentLinkIds || []).map((id: string) => cancelPaymentLink(id)));
      url = link.url;
    } else {
      const issued = await issueGuestLink(tenantKey, isDemo, { guestId: doc.guestId as any, guestName: doc.guestName, guestPhone: doc.guestPhone });
      url = `${issued.url}&ref=${encodeURIComponent(doc.reference)}`;
    }
    await whatsapp(isDemo, doc.guestPhone, messages.quoteAcceptedGuestMessage(doc, url, cfg.advanceWindowMin));
  } catch (err: any) {
    logger.warn(`[StayRide] advance request failed for ${doc.reference} (retried by the cab cycle): ${err?.message}`, { action: 'payment.advance_request_failed', tenantId: tenantKey, metadata: { ref: doc.reference, isDemo, amount: doc.advanceAmount } });
  }
}

/** Cab cycle: a trip waiting for its advance whose Razorpay link failed gets the link (and the guest's WhatsApp) now. */
export async function retryMissingPaymentLinks(): Promise<number> {
  if (!gatewayEnabled()) return 0; // gateway off: the guest already got the status page link
  const docs: any[] = await cabModel(false)
    .find({
      status: 'AWAITING_ADVANCE_PAYMENT',
      advancePaid: { $ne: true },
      advanceAmount: { $gt: 0 },
      paymentLinkId: { $in: ['', null] },
      updatedAt: { $lt: new Date(Date.now() - 2 * 60000) }, // never race the first attempt, still in flight
    })
    .limit(10)
    .lean();
  if (docs.length) logger.info(`[Payments] retrying ${docs.length} missing payment link(s)`, { action: 'payment.link_retry', metadata: { refs: docs.map((d) => d.reference) } });
  for (const doc of docs) await requestAdvance(String(doc.propertyId), false, doc);
  return docs.length;
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
 * Lazily mark open requests whose pickup time has come as EXPIRED (and their pending quotes): nobody can quote
 * on a ride that should already have left. Then tell nearby drivers about requests whose own-first window is
 * over. Called by every list that shows open requests (driver, owner, admin) and by the cab cycle. Idempotent.
 */
export async function expireStaleRequests(isDemo: boolean, extra: Record<string, any> = {}): Promise<number> {
  await releaseUnpaidAdvances(isDemo, extra); // same lazy hook: every list that shows requests runs it
  await expireOldQuotes(isDemo, extra);
  await autoSelectLowestQuotes(isDemo, extra);
  await checkBiddingFallbacks(isDemo, extra);
  await autoCompleteTrips(isDemo, extra);
  await sendCompletionReminders(isDemo, extra);
  const now = Date.now();
  const Cab = cabModel(isDemo);
  // pickupAt < date + 1 day, so anything with date >= now + 1 day cannot be due yet.
  const candidates: any[] = await Cab.find({ ...extra, status: { $in: OPEN_STATUSES }, date: { $lt: now + DAY_MS } })
    .select('_id date time reference propertyId')
    .sort({ date: 1 })
    .limit(500)
    .lean();
  const due = candidates.filter((d) => (istDateTime(d.date, d.time) ?? Number(d.date)) <= now);
  const ids = due.map((d) => d._id);
  let expired = 0;
  if (ids.length) {
    const r = await Cab.updateMany(
      { _id: { $in: ids }, status: { $in: OPEN_STATUSES } },
      { $set: { status: 'EXPIRED', 'quotes.$[q].status': 'EXPIRED' } },
      { arrayFilters: [{ 'q.status': 'PENDING' }] }
    );
    expired = r.modifiedCount;
    if (expired) {
      logger.info(`[Cab] ${expired} request(s) expired at pickup time`, {
        action: 'cab.expired',
        metadata: { isDemo, count: expired, trips: due.map((d) => ({ ref: d.reference, tenantId: String(d.propertyId) })) },
      });
    }
  }
  await notifyNearbyDue(isDemo, extra);
  return expired;
}

// Own drivers hear about a request first; nearby drivers only once no own driver took or quoted it in this window.
export const OWN_FIRST_MS = 10 * 60000;
// A pickup sooner than this goes to everyone at once: there is no time to wait for own drivers.
export const OWN_FIRST_MIN_LEAD_MS = 2 * HOUR_MS;

/** When nearby drivers may hear about (and see) a request sent out now; null = right away. */
export const nearbyNotifyTime = (pickupAt: number, now: number, hasOwnDrivers: boolean): Date | null =>
  hasOwnDrivers && pickupAt - now >= OWN_FIRST_MIN_LEAD_MS ? new Date(now + OWN_FIRST_MS) : null;

/** The homestay's own drivers who can be messaged (active, with a phone). */
async function ownDriversOf(tenantKey: string): Promise<any[]> {
  try {
    return ((await tenantManager.load(tenantKey)).drivers || []).filter((d: any) => d.active && d.phone);
  } catch {
    return [];
  }
}

/**
 * Fields that send a request out to drivers: the admin's bidding window (shortened for a close pickup, and
 * never past the pickup, when the request expires) and the own-first delay for nearby drivers.
 */
export async function dispatchFields(tenantKey: string, isDemo: boolean, date: unknown, time: unknown) {
  const cfg = await cfgOf(isDemo);
  const now = Date.now();
  const defaultWindowMin = cfg.quoteBiddingWindowMin ?? ((cfg.quoteWindowHours || 4) * 60);
  const pickupAt = istDateTime(date, time) ?? Number(date);
  const leadTimeMin = Math.max(0, Math.floor((pickupAt - now) / 60000));
  const windowMin = leadTimeMin > 0 && leadTimeMin < defaultWindowMin + 30 ? Math.max(10, leadTimeMin - 30) : defaultWindowMin;
  return {
    dispatched: true,
    biddingClosesAt: new Date(Math.min(now + windowMin * 60000, pickupAt)),
    nearbyNotifyAt: nearbyNotifyTime(pickupAt, now, (await ownDriversOf(tenantKey)).length > 0),
  };
}

/** Own-first window over and no own driver holds a live quote (or took it): nearby drivers now hear about it. */
async function notifyNearbyDue(isDemo: boolean, extra: Record<string, any> = {}) {
  const Cab = cabModel(isDemo);
  const due = {
    status: { $in: OPEN_STATUSES },
    dispatched: { $ne: false },
    nearbyNotifyAt: { $lte: new Date() },
    quotes: { $not: { $elemMatch: { isOwnDriver: true, status: 'PENDING' } } },
  };
  const docs: any[] = await Cab.find({ ...extra, ...due }).select('_id').limit(50).lean();
  for (const { _id } of docs) {
    // clearing the date is the claim: only one caller notifies, and from now on nearby drivers can see it
    const doc = await Cab.findOneAndUpdate({ _id, ...due }, { $set: { nearbyNotifyAt: null } }, { returnDocument: 'after' }).lean();
    if (doc) await notifyNearby(isDemo, doc).catch((err: any) => console.warn(`[notifyNearby] ${(doc as any).reference}:`, err?.message));
  }
}

/**
 * Confirmed driver whose guest never paid in time (only when the admin set a payment window): reopen
 * the request. The unpaid driver's quote is dropped (he may quote again), quotes that lost to him become live
 * again (never a blocked driver's), and the frozen money split and driver fields are cleared. An own-fleet trip goes back to the
 * owner as a held request so they can choose again. Lazy like expiry, and one conditional update per request so a payment
 * recorded meanwhile wins (the update only matches an unpaid, AWAITING_ADVANCE_PAYMENT request).
 */
export async function releaseUnpaidAdvances(isDemo: boolean, extra: Record<string, any> = {}): Promise<number> {
  const Cab = cabModel(isDemo);
  const now = Date.now();
  const windowMin = (await cfgOf(isDemo)).advanceWindowMin;
  const overdue = {
    status: 'AWAITING_ADVANCE_PAYMENT',
    advancePaid: { $ne: true },
    // legacy holds confirmed with no due date: overdue once a full window passed since the last change
    $or: [{ advanceDueAt: { $lt: new Date(now) } }, ...(windowMin > 0 ? [{ advanceDueAt: null, updatedAt: { $lt: new Date(now - windowMin * 60000) } }] : [])],
  };
  const docs: any[] = await Cab.find({ ...extra, ...overdue }).select('_id assignedDriverUserId quotes.driverId paymentLinkId paymentClaim').limit(100).lean();
  let released = 0;
  for (const { _id, assignedDriverUserId, quotes, paymentLinkId, paymentClaim } of docs) {
    // Only quotes that lost to the confirmed driver come back, and never a blocked driver's.
    const blocked = [...(await inactiveDrivers(isDemo, (quotes || []).map((q: any) => q.driverId)))];
    // Pipeline update (raw driver: Mongoose needs a flag for these): the pull and the re-open touch the same array.
    const updated: any = await Cab.collection.findOneAndUpdate({ _id, ...overdue, assignedDriverUserId }, [
      {
        $set: {
          quotes: {
            $map: {
              input: { $filter: { input: '$quotes', cond: { $ne: ['$$this.status', 'ACCEPTED'] } } },
              as: 'q',
              in: {
                $cond: [
                  { $and: [{ $eq: ['$$q.status', 'REJECTED'] }, { $eq: ['$$q.outbid', true] }, { $not: [{ $in: [{ $toString: '$$q.driverId' }, blocked] }] }] },
                  { $mergeObjects: ['$$q', { status: 'PENDING', outbid: false }] },
                  '$$q',
                ],
              },
            },
          },
        },
      },
      {
        $set: {
          status: { $cond: [{ $in: ['PENDING', { $ifNull: ['$quotes.status', []] }] }, 'QUOTE_RECEIVED', 'FINDING_DRIVER'] },
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
          paymentClaim: null, // a claim nobody verified within its grace dies with the hold (kept in the audit log)
          dispatched: { $cond: [{ $eq: ['$ownFleet', true] }, false, { $ifNull: ['$dispatched', true] }] },
          ownFleet: false,
          ownDriverId: null,
        },
      },
      { $unset: 'financialSnapshot' },
    ], { returnDocument: 'after' });
    if (!updated) continue; // paid, cancelled or released by someone else meanwhile
    released++;
    logger.info(`[Cab] ${updated.reference}: advance not paid in time, driver released`, {
      action: 'cab.advance_released',
      tenantId: String(updated.propertyId),
      driverId: assignedDriverUserId ? String(assignedDriverUserId) : undefined,
      metadata: { ref: updated.reference, isDemo, status: updated.status, paymentLinkId, unverifiedClaimUtr: paymentClaim?.status === 'PENDING' ? paymentClaim.utr : undefined, reopenedQuotes: (updated.quotes || []).filter((q: any) => q.status === 'PENDING').length },
    });
    const msg = { title: 'Advance not paid in time', body: `Trip ${updated.reference} is open again. Choose another driver.`, data: tripData(updated, 'ADVANCE_EXPIRED') };
    await Promise.allSettled([
      pushOwner(isDemo, String(updated.propertyId), msg),
      pushUsers(isDemo, [assignedDriverUserId].filter(Boolean), { ...msg, body: `Trip ${updated.reference} was released: the guest did not pay the advance.` }),
      whatsapp(isDemo, updated.guestPhone, messages.advanceExpiredGuestMessage(updated)),
      cancelPaymentLink(paymentLinkId), // that fare is gone: its link must not be paid late
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
  const doc: any = await Cab.findOne({ reference, propertyId: tenantKey }).lean();
  if (!doc) throw httpError(404, 'Trip not found');
  if (OPEN_STATUSES.includes(doc.status) && doc.dispatched !== false) return doc; // already sent
  if (!OPEN_STATUSES.includes(doc.status)) throw conflict('This request can no longer be sent to drivers.');

  const updated = await Cab.findOneAndUpdate(
    { reference, propertyId: tenantKey, status: { $in: OPEN_STATUSES }, dispatched: false },
    { $set: await dispatchFields(tenantKey, isDemo, doc.date, doc.time) },
    { returnDocument: 'after' }
  );
  if (updated) {
    await notifyNewRequest(isDemo, updated);
    return updated;
  }
  return doc;
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
  const orphans = await Cab.find(filter).select('_id reference').limit(50).lean();
  if (!orphans.length) return;
  logger.warn(`[Cab] cancelling ${orphans.length} orphan request(s) of ${tenantKey}`, {
    action: 'cab.cancel_orphans',
    tenantId: tenantKey,
    metadata: { isDemo, refs: orphans.map((o: any) => o.reference), cancelledBy: 'system', reason: 'Request was not saved for the homestay' },
  });
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

async function pricedUpdate(doc: any, fare: number, isDemo: boolean, isOwnDriver = false) {
  // All-inclusive winning quote fare. System calculates advance, total commission, and splits.
  const split = await CommissionService.calculateSplit(fare, String(doc.propertyId), isDemo, isOwnDriver);
  // the split saved onto the trip (calculateSplit's own log line carries the rates it used)
  logger.info(`[Money] split for ${doc.reference}: fare ₹${split.agreedFare}, advance ₹${split.advanceAmount}`, {
    action: 'money.split',
    tenantId: String(doc.propertyId),
    metadata: { ref: doc.reference, isDemo, isOwnDriver, fareInput: fare, ...split },
  });
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
    if (!d) return { ...t, platform: true, status: 'CANCELLED', cancellationReason: 'This request could not be processed. Please create it again.', quotes: [], driverRated: false };
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
      paymentClaimPending: d.paymentClaim?.status === 'PENDING',
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
/** `counterFare`: the driver accepted the owner's counter-offer; the trip is confirmed at that fare in the same write. */
export async function ownerConfirmQuote(tenantKey: string, isDemo: boolean, reference: string, driverUserId: string, actor: string, counterFare?: number) {
  const Model = cabModel(isDemo);
  const doc: any = await Model.findOne({ reference, propertyId: tenantKey }).lean();
  if (!doc) throw httpError(404, 'Trip not found');
  const quote = (doc.quotes || []).find((q: any) => String(q.driverId) === String(driverUserId) && q.status === 'PENDING');
  if (!quote) throw httpError(400, 'Choose one of the drivers who sent a quote.');
  if (counterFare !== undefined && quote.counterFare !== counterFare) throw conflict('This offer changed. Refresh and try again.');
  let driver: any = null;
  let blocked = false; // a platform driver whose account is not ACTIVE: no fallback may honour his quote
  const quoteDriverIdStr = String(quote.driverId);
  if (isDemo && quoteDriverIdStr === 'demo-driver-1') {
    driver = { vehicle: { plate: '' } };
  } else if (quoteDriverIdStr.startsWith('own-')) {
    const ownId = quoteDriverIdStr.replace(/^own-/, '');
    try {
      const store = await tenantManager.load(tenantKey);
      const d: any = (store.drivers || []).find((x: any) => String(x.id) === ownId);
      if (d) driver = { vehicle: { plate: d.plate || d.vehicle || '' }, accountStatus: 'ACTIVE' };
    } catch {}
    if (!driver) {
      try {
        const d = await driverModel(isDemo).findOne({
          $or: [{ id: ownId }, ...(mongoose.Types.ObjectId.isValid(ownId) ? [{ _id: ownId }] : [])],
        }).lean();
        if (d) driver = { vehicle: { plate: d.plate || '' }, accountStatus: 'ACTIVE' };
      } catch {}
    }
  } else if (mongoose.Types.ObjectId.isValid(quoteDriverIdStr)) {
    const u: any = await userModel(isDemo).findOne({ _id: quoteDriverIdStr, role: 'driver' }).lean();
    blocked = Boolean(u && u.accountStatus !== 'ACTIVE');
    if (u && !blocked) driver = u;
    if (!u) {
      const d = await driverModel(isDemo).findOne({ _id: quoteDriverIdStr, status: { $in: ['Active', 'On a trip'] } }).lean();
      if (d) driver = { vehicle: { plate: d.plate || '' }, accountStatus: 'ACTIVE' };
    }
  } else {
    try {
      const d = await driverModel(isDemo).findOne({ id: quoteDriverIdStr }).lean();
      if (d) driver = { vehicle: { plate: d.plate || '' }, accountStatus: 'ACTIVE' };
    } catch {}
  }
  // Fallback: If quote exists and has vehicle details, honor it
  if (!driver && !blocked && quote.driverPhone) {
    driver = { vehicle: { plate: quote.driverVehicle || '' }, accountStatus: 'ACTIVE' };
  }
  if (!driver) throw conflict('This driver is no longer available.');
  if (await driverHasOverlap(isDemo, quoteDriverIdStr, doc)) throw conflict('This driver already has another trip within 3 hours of this pickup.');
  // Fare comes from the driver's quote (or the counter-offer he accepted), never from the client.
  const fare = counterFare ?? quote.quotedFare;
  const isOwn = Boolean(quote.isOwnDriver || quoteDriverIdStr.startsWith('own-'));
  const priced = await pricedUpdate(doc, fare, isDemo, isOwn);
  const cfg = await cfgOf(isDemo);
  const updated = await Model.findOneAndUpdate(
    {
      _id: doc._id,
      status: { $in: ['FINDING_DRIVER', 'QUOTE_RECEIVED', 'PENDING_REVIEW'] },
      dispatched: { $ne: false },
      advancePaid: { $ne: true },
      // the fare we priced must still be the driver's current quote / counter (drivers may revise it)
      quotes: { $elemMatch: { driverId: quote.driverId, status: 'PENDING', quotedFare: quote.quotedFare, ...(counterFare !== undefined ? { counterFare } : {}) } },
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
        assignedDriverCategory: quote.driverCategory || 'INDIVIDUAL',
        assignedDriverUnionName: quote.unionName || '',
        vehicleDetails: {
          model: quote.driverVehicleModel || (driver as any).vehicle?.model || quote.driverVehicle || '',
          plate: quote.driverVehiclePlate || (driver as any).vehicle?.plate || '',
        },
        'quotes.$[q].status': 'ACCEPTED',
        'quotes.$[q].quotedFare': fare,
        'quotes.$[q].counterFare': null,
        'quotes.$[o].status': 'REJECTED',
        'quotes.$[o].outbid': true, // lost to this driver: may come back if the guest never pays
      },
    },
    {
      returnDocument: 'after',
      arrayFilters: [{ 'q.driverId': quote.driverId }, { 'o.driverId': { $ne: quote.driverId }, 'o.status': 'PENDING' }],
    }
  );
  if (!updated) throw conflict('This request already has a confirmed driver, or the quote changed. Refresh and try again.');
  await audit(actor, 'cab.confirm_quote', 'CabRequest', String(doc._id), { reference, driverUserId, fare: priced.agreedFare, counterAccepted: counterFare !== undefined }, isDemo, scope(doc));
  // Driver: push + WhatsApp. Guest: WhatsApp with the advance to pay, but not the driver's phone yet.
  // The confirm is already committed: nothing below may fail the request.
  await Promise.allSettled([
    pushUsers(isDemo, [quote.driverId], { title: 'Your quote was accepted', body: `Trip ${reference} is yours once the advance is paid.`, data: tripData(updated, 'QUOTE_CONFIRMED') }),
    whatsapp(isDemo, quote.driverPhone, messages.quoteAcceptedDriverMessage(quote.driverName, reference), scope(updated)),
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
  const pickupOtp = doc.pickupOtp || String(crypto.randomInt(1000, 10000));
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
  logger.info(`[Money] own-fleet split for ${reference}: fare ₹${fare}, fee ₹${fee}`, {
    action: 'money.split',
    tenantId: tenantKey,
    driverId: `own-${driver.id}`,
    metadata: { ref: reference, isDemo, ownFleet: true, fareInput: fareInput, ownFleetFeePercent: cfg.ownFleetFeePercent, ownFleetMinFee: cfg.ownFleetMinFee, ...snapshot },
  });
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
        pickupOtp,
        advanceDueAt: noFee ? null : dueAt(cfg),
        paymentLinkId: '',
        paymentLinkUrl: '',
        assignedDriverUserId: null,
        assignedDriverName: driver.name,
        assignedDriverPhone: driver.phone,
        vehicleDetails: { model: driver.vehicle || '', plate: driver.plate || '' },
        'quotes.$[p].status': 'REJECTED',
        'quotes.$[p].outbid': true,
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
          whatsapp(isDemo, driver.phone, messages.advancePaidDriverMessage(updated, driverQuoteLink(isDemo, `own-${driver.id}`, updated.reference))),
          confirmGuestWhatsApp(isDemo, updated),
        ])
      : Promise.all([whatsapp(isDemo, driver.phone, messages.quoteAcceptedDriverMessage(driver.name, reference), { tenantId: tenantKey, driverId: `own-${driver.id}` }), requestAdvance(tenantKey, isDemo, updated)]),
  ]);
  return updated;
}

/** Cancel by owner/admin. Paid advances become a PENDING refund that only admin can close. */
export async function cancelRequest(
  filter: Record<string, any>,
  isDemo: boolean,
  actor: string,
  reason: string,
  isAdmin = false
) {
  const Model = cabModel(isDemo);
  const doc: any = await Model.findOne(filter).lean();
  if (!doc) throw httpError(404, 'Trip not found');
  if (doc.status === 'CANCELLED') return doc;
  if (doc.status === 'COMPLETED') throw conflict('A completed trip cannot be cancelled.');
  if (doc.hostPayoutId) throw conflict('This trip is already part of a payout.');
  if (doc.driverPayoutId) throw conflict('This trip is part of an active driver payout request and cannot be cancelled until resolved.');

  const isPlatformAdmin = isAdmin; // only the admin route says so; never inferred from the actor's email
  // A ₹0 advance (own-fleet trip with no fee) is marked paid but no money was taken: nothing to refund.
  const paidMoney = Boolean(doc.advancePaid && doc.advanceAmount > 0);

  // Non-admins (such as homestay owners) cannot cancel trips once advance is paid or trip has started
  if (!isPlatformAdmin) {
    if (['TRIP_STARTED', 'COMPLETED'].includes(doc.status)) {
      throw conflict(`A ${doc.status.toLowerCase().replace('_', ' ')} trip cannot be cancelled.`);
    }
    if (paidMoney) {
      throw conflict('This ride is booked with a paid advance deposit. Please contact support to cancel and process the refund.');
    }
  }

  const updated = await Model.findOneAndUpdate(
    // advancePaid pinned: if admin records the payment meanwhile, this fails instead of losing the refund
    {
      _id: doc._id,
      status: isPlatformAdmin ? { $ne: 'CANCELLED' } : { $nin: ['TRIP_STARTED', 'COMPLETED', 'CANCELLED'] },
      hostPayoutId: null,
      driverPayoutId: null,
      advancePaid: doc.advancePaid ? true : { $ne: true },
    },
    {
      $set: {
        status: 'CANCELLED',
        cancellationReason: String(reason || '').slice(0, 300),
        cancelledBy: actor,
        refundStatus: paidMoney ? 'PENDING' : 'NONE',
      },
    },
    { returnDocument: 'after' }
  );
  if (!updated) throw conflict('The trip changed meanwhile. Refresh and try again.');
  await audit(
    actor,
    'cab.cancel',
    'CabRequest',
    String(doc._id),
    {
      reason,
      refundDue: paidMoney ? doc.advanceAmount : 0,
      cancelledByAdmin: isPlatformAdmin,
      guestPhone: maskPhone(doc.guestPhone),
      guestName: doc.guestName,
      refundStatus: paidMoney ? 'PENDING' : 'NONE',
    },
    isDemo,
    scope(doc)
  );
  const msg = { title: 'Trip cancelled', body: `Trip ${doc.reference} was cancelled.`, data: tripData(doc, 'TRIP_CANCELLED') };
  const drivers = [doc.assignedDriverUserId, ...(doc.quotes || []).filter((q: any) => q.status === 'PENDING').map((q: any) => q.driverId)].filter(Boolean);
  await Promise.allSettled([
    pushUsers(isDemo, drivers, msg),
    actor === doc.propertyId ? Promise.resolve() : pushOwner(isDemo, String(doc.propertyId), msg),
    doc.guestPhone ? whatsapp(isDemo, doc.guestPhone, messages.tripCancelledGuestMessage(updated)) : Promise.resolve(),
    doc.advancePaid ? Promise.resolve() : cancelPaymentLink(doc.paymentLinkId), // the guest must not pay a cancelled trip
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
    (driverUserId && String(linkDriverId(d)) === driverUserId) ||
    (cleanPhone && d.assignedDriverPhone && String(d.assignedDriverPhone).replace(/\D/g, '').endsWith(cleanPhone))
  );
  const driverView = assigned
    ? (d.status === 'CANCELLED' ? 'CANCELLED' : 'ASSIGNED')
    : OPEN_STATUSES.includes(d.status)
      ? (mine ? 'QUOTED' : 'OPEN')
      : (d.previousDriverUserIds || []).includes(driverUserId)
        ? 'REASSIGNED'
        : d.status === 'EXPIRED' ? 'EXPIRED' : d.status === 'CANCELLED' ? 'CANCELLED' : 'TAKEN'; // TAKEN: went to another driver
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
    myQuote: mine ? { quotedFare: mine.quotedFare, status: mine.status, notes: mine.notes || '', counterFare: mine.counterFare ?? null, driverCategory: mine.driverCategory, unionName: mine.unionName } : null,
    assignedToMe: assigned,
    assignedDriverCategory: d.assignedDriverCategory || 'INDIVIDUAL',
    assignedDriverUnionName: d.assignedDriverUnionName || '',
    // No guest identity / cash due before the advance is paid. The boarding PIN never goes to the driver:
    // the guest tells it at pickup (that is the check).
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
    // Only requests the owner sent out and whose own-first window is over (own drivers use their WhatsApp link).
    // ponytail: vehicle and distance are filtered in JS over the 200 soonest open requests; query them in Mongo when that is too few.
    quotesOn
      ? Cab.find({ status: { $in: OPEN_STATUSES }, dispatched: { $ne: false }, nearbyNotifyAt: null })
          .sort({ date: 1 })
          .limit(200)
          .lean()
      : Promise.resolve([]),
  ]);
  // Same rules as the drivers who are told about a request (matchingDrivers): vehicle class, then radius / area.
  const radius = (await cfgOf(isDemo)).nearbyRadiusKm;
  const freshLocation = freshLocationOf(driver);
  const near = (open as any[]).filter((d) =>
    vehicleFits(driver.vehicle, d) && nearbyPasses(distanceKm(freshLocation, pickupOriginOf(d)), radius, driver.vehicle?.area, d.homestayArea)
  ).slice(0, 50);
  const byRef = new Map<string, any>();
  for (const d of [...mine, ...near] as any[]) if (!byRef.has(d.reference)) byRef.set(d.reference, driverTripView(d, id, driver.phone));
  return [...byRef.values()];
}

/** A driver quotes, or revises their own quote, while the request is still open. */
export async function driverSubmitQuote(
  isDemo: boolean,
  reference: string,
  driver: any,
  fareInput: unknown,
  notes: unknown,
  overrideVehicle?: { plate?: string; model?: string; driverName?: string }
) {
  const cfg = await cfgOf(isDemo);
  const quotedFare = parseFare(fareInput, cfg.maxFare);
  const Model = cabModel(isDemo);
  const driverId = String(driver._id);
  const cleanNotes = typeof notes === 'string' ? notes.trim().slice(0, 300) : '';
  if (containsContactInfo(cleanNotes)) {
    throw httpError(400, 'Notes cannot contain phone numbers, links or emails. Contact details are shared once the advance is paid.');
  }
  await expireStaleRequests(isDemo, { reference });

  const plateOverride = typeof overrideVehicle?.plate === 'string' ? overrideVehicle.plate.trim().toUpperCase().slice(0, 25) : '';
  const modelOverride = typeof overrideVehicle?.model === 'string' ? overrideVehicle.model.trim().slice(0, 50) : '';
  const nameOverride = typeof overrideVehicle?.driverName === 'string' ? overrideVehicle.driverName.trim().slice(0, 60) : '';

  const effectivePlate = plateOverride || driver.vehicle?.plate || '';
  const effectiveModel = modelOverride || driver.vehicle?.model || driver.vehicle?.type || '';
  const effectiveDriverName = nameOverride || driver.name || '';
  const vehicleStr = [effectiveModel, effectivePlate].filter(Boolean).join(' ') || driver.vehicle?.type || '';

  // Anti-gouging protection against unreasonable fares exceeding vehicle tier baselines
  const existingReq: any = await Model.findOne({ reference, status: { $in: OPEN_STATUSES }, dispatched: { $ne: false } }).select('vehicleType propertyId nearbyNotifyAt').lean();
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
  // Determine if quoting driver is an in-house own-driver for this homestay
  let isOwnDriver = Boolean(driver.isOwnDriver || String(driver._id).startsWith('own-'));
  if (!isOwnDriver) {
    try {
      const store = await tenantManager.load(String(existingReq.propertyId));
      const phone10 = String(driver.phone || '').replace(/\D/g, '').slice(-10);
      isOwnDriver = Boolean(
        (store.drivers || []).some((d: any) => d.active && String(d.phone || '').replace(/\D/g, '').slice(-10) === phone10)
      );
    } catch {}
  }
  // Own drivers get the first minutes (see dispatchFields); nearby drivers can't quote before then.
  if (!isOwnDriver && existingReq.nearbyNotifyAt) throw conflict('This request is not open to nearby drivers yet.');
  const openTo = { reference, status: { $in: OPEN_STATUSES }, dispatched: { $ne: false }, ...(isOwnDriver ? {} : { nearbyNotifyAt: null }) };

  const revise = () =>
    Model.findOneAndUpdate(
      { ...openTo, quotes: { $elemMatch: { driverId, status: { $in: ['PENDING', 'EXPIRED'] } } } },
      {
        $set: {
          'quotes.$.quotedFare': quotedFare,
          'quotes.$.notes': cleanNotes,
          'quotes.$.driverVehicle': vehicleStr,
          'quotes.$.driverVehiclePlate': effectivePlate,
          'quotes.$.driverVehicleModel': effectiveModel,
          'quotes.$.driverName': effectiveDriverName,
          'quotes.$.createdAt': new Date(),
          'quotes.$.status': 'PENDING', // an expired quote comes back to life with the new fare
          'quotes.$.counterFare': null,
          'quotes.$.counterAt': null,
          'quotes.$.driverRating': ratingOf(driver).driverRating || 0,
          'quotes.$.isOwnDriver': isOwnDriver,
          'quotes.$.driverCategory': driver.driverCategory || 'INDIVIDUAL',
          'quotes.$.unionName': driver.unionName || '',
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
      { ...openTo, 'quotes.driverId': { $ne: driverId } },
      {
        $push: {
          quotes: {
            driverId,
            driverName: effectiveDriverName,
            driverPhone: driver.phone || '',
            driverVehicle: vehicleStr,
            driverVehiclePlate: effectivePlate,
            driverVehicleModel: effectiveModel,
            vehicleType: driver.vehicle?.type || '',
            driverRating: ratingOf(driver).driverRating || 0,
            quotedFare,
            notes: cleanNotes,
            isOwnDriver,
            driverCategory: driver.driverCategory || 'INDIVIDUAL',
            unionName: driver.unionName || '',
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
  logger.info(`[Cab] ${reference}: ${isNew ? 'quote' : 'revised quote'} ₹${quotedFare}`, {
    action: 'cab.quote',
    tenantId: String(updated.propertyId),
    driverId,
    metadata: { ref: reference, isDemo, quotedFare, fareInput, isNew, isOwnDriver, vehicle: vehicleStr, notes: cleanNotes, estFare: estFare || null },
  });
  await pushOwner(isDemo, String(updated.propertyId), {
    title: isNew ? 'New driver quote' : 'Driver updated a quote',
    body: `₹${quotedFare.toLocaleString('en-IN')} for trip ${reference}.`,
    data: tripData(updated, 'NEW_QUOTE'),
  });
  if (cfg.quoteBiddingWindowMin === 0) {
    // awaited: the confirm WhatsApps would be lost if the serverless function froze after the response
    await autoSelectLowestQuotes(isDemo, { reference }).catch(() => {});
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

export const HILL_LANDMARK_COORDS: Record<string, { lat: number; lng: number }> = {
  njp: { lat: 26.6853, lng: 88.4312 },
  'new jalpaiguri': { lat: 26.6853, lng: 88.4312 },
  bagdogra: { lat: 26.6812, lng: 88.3286 },
  airport: { lat: 26.6812, lng: 88.3286 },
  siliguri: { lat: 26.7271, lng: 88.3953 },
  darjeeling: { lat: 27.0410, lng: 88.2663 },
  kurseong: { lat: 26.8812, lng: 88.2789 },
  kalimpong: { lat: 27.0594, lng: 88.4695 },
  mirik: { lat: 26.8906, lng: 88.1887 },
  ghum: { lat: 27.0112, lng: 88.2576 },
  'tiger hill': { lat: 27.0000, lng: 88.2833 },
};

export function resolveDestinationCoordinates(trip: any): { lat: number; lng: number } | null {
  const dests = trip.destinations || [];
  const lastDest = dests.length ? dests[dests.length - 1] : null;
  if (lastDest && typeof lastDest.lat === 'number' && Number.isFinite(lastDest.lat) && typeof lastDest.lng === 'number' && Number.isFinite(lastDest.lng)) {
    return { lat: lastDest.lat, lng: lastDest.lng };
  }
  const addr = `${lastDest?.address || ''} ${trip.destination || ''}`.toLowerCase();
  for (const [key, coords] of Object.entries(HILL_LANDMARK_COORDS)) {
    if (addr.includes(key)) return coords;
  }
  return null;
}

/** One rule for the requests a driver's vehicle can take: who is told about a request = what he can see. */
export function vehicleFits(vehicle: any, doc: any): boolean {
  const type = String(vehicle?.type || '');
  if (!type) return true; // not set yet: hears about every request
  const pax = Number(doc.passengers || 1);
  // 5+ passengers needs a 6-7 seater mountain vehicle (Bolero, Scorpio, Innova, Xylo), never a hatchback / sedan
  if (pax > 4) return !['Hatchback', 'Sedan'].includes(type) && (['SUV', 'MUV', '7-seater', '9-seater'].includes(type) || Number(vehicle.seats) >= pax);
  return !doc.vehicleType || type === doc.vehicleType;
}

/** Same town, case-insensitive and trimmed; an empty area never matches. */
export function areaMatches(driverArea: unknown, homestayArea: unknown): boolean {
  const a = String(driverArea ?? '').trim().toLowerCase();
  return Boolean(a) && a === String(homestayArea ?? '').trim().toLowerCase();
}

/** Radius filter: with a known distance, within the radius; without GPS, only a driver based in the homestay's area. 0 = no filter. */
export const nearbyPasses = (km: number | null, radiusKm: number, driverArea: unknown, homestayArea: unknown) =>
  radiusKm <= 0 || (km === null ? areaMatches(driverArea, homestayArea) : km <= radiusKm);

// 60-minute GPS recency: older coordinates are stale in mountain terrain (drivers would match across ridges).
const freshLocationOf = (d: any) => {
  const age = d.location?.updatedAt ? Date.now() - new Date(d.location.updatedAt).getTime() : Infinity;
  return age <= HOUR_MS ? d.location : null;
};
const pickupOriginOf = (doc: any) => (doc.pickupLocation?.lat && doc.pickupLocation?.lng ? doc.pickupLocation : doc.homestayLocation);

/**
 * Drivers who should hear about a request: approved, available, same vehicle class (or none set), and
 * within the admin's radius of the homestay (no GPS: based in the homestay's area). Nearest first; drivers who never shared a location come
 * last so a new network is not starved. ponytail: distance computed in JS over at most 2000 drivers;
 * move to a 2dsphere index when the network is bigger.
 */
export async function matchingDrivers(isDemo: boolean, doc: any, cfg: PlatformConfig): Promise<any[]> {
  // Active "On-Ride" check: find drivers who are currently driving on an active ride (TRIP_STARTED)
  const activeTrips: any[] = await cabModel(isDemo).find({
    status: 'TRIP_STARTED',
    assignedDriverUserId: { $exists: true, $ne: null },
  }).select('assignedDriverUserId').lean();

  const onRideDriverIds = new Set(activeTrips.map((t) => String(t.assignedDriverUserId)));

  const all: any[] = await userModel(isDemo)
    .find({ role: 'driver', accountStatus: 'ACTIVE', isAvailable: { $ne: false } })
    .select('_id name phone vehicle driverCategory unionName location whatsappAlerts ratingSum ratingCount')
    .limit(2000)
    .lean();

  // Discard drivers who are currently on an active ride, and vehicles that can't take this request
  const availableDrivers = all.filter((d) => !onRideDriverIds.has(String(d._id)) && vehicleFits(d.vehicle, doc));

  const pickupOrigin = pickupOriginOf(doc);

  const scored = availableDrivers.map((d) => {
    // Stale GPS is ignored: the driver then counts only if his registered base area (vehicle.area) is the homestay's.
    const km = distanceKm(freshLocationOf(d), pickupOrigin);
    const areaMatch = areaMatches(d.vehicle?.area, doc.homestayArea);
    const avgRating = d.ratingCount && d.ratingCount > 0 ? (d.ratingSum || 0) / d.ratingCount : 4.5;
    return { d, km, areaMatch, avgRating };
  });

  return scored
    .filter((x) => nearbyPasses(x.km, cfg.nearbyRadiusKm, x.d.vehicle?.area, doc.homestayArea))
    .sort((x, y) => {
      // 1. If GPS is available on both, closest distance wins (rating tie-breaker within 2km)
      if (x.km !== null && y.km !== null) {
        if (Math.abs(x.km - y.km) > 2) {
          return x.km - y.km;
        }
        if (y.avgRating !== x.avgRating) {
          return y.avgRating - x.avgRating;
        }
        return x.km - y.km;
      }
      if (x.km !== null) return -1;
      if (y.km !== null) return 1;

      // 2. If no GPS, drivers whose registered hill area matches pickup town get priority
      if (x.areaMatch && !y.areaMatch) return -1;
      if (!x.areaMatch && y.areaMatch) return 1;

      // 3. Review rating based priority
      if (y.avgRating !== x.avgRating) {
        return y.avgRating - x.avgRating;
      }
      return 0;
    })
    .map((x) => x.d);
}

/**
 * Tell drivers about a request just sent out: the homestay's own drivers on WhatsApp now; nearby drivers now
 * too unless the request waits for them (nearbyNotifyAt, see dispatchFields), then the cab cycle tells them.
 */
export async function notifyNewRequest(isDemo: boolean, doc: any) {
  const settings = await CommissionService.getSettings(isDemo);
  if (!CommissionService.globalFeatures(settings).driverQuotes.enabled) return;
  const own = await ownDriversOf(String(doc.propertyId));
  logger.info(`[Cab] ${doc.reference} dispatched: ${own.length} own driver(s), nearby ${doc.nearbyNotifyAt ? 'at ' + new Date(doc.nearbyNotifyAt).toISOString() : 'now'}`, {
    action: 'cab.dispatched',
    tenantId: String(doc.propertyId),
    metadata: { ref: doc.reference, isDemo, ownDrivers: own.length, nearbyNotifyAt: doc.nearbyNotifyAt || null, biddingClosesAt: doc.biddingClosesAt || null, vehicleType: doc.vehicleType },
  });
  await Promise.allSettled(own.map((d: any) => whatsapp(isDemo, d.phone, messages.newRequestMessage(doc, driverQuoteLink(isDemo, `own-${d.id}`, doc.reference)))));
  if (!doc.nearbyNotifyAt) await notifyNearby(isDemo, doc);
}

/** Nearby (network) drivers: push to every matching one, WhatsApp to the nearest few (capped at driverBroadcastMax). */
async function notifyNearby(isDemo: boolean, doc: any) {
  const settings = await CommissionService.getSettings(isDemo);
  if (!CommissionService.globalFeatures(settings).driverQuotes.enabled) return;
  const cfg = CommissionService.platformConfig(settings);
  const drivers = await matchingDrivers(isDemo, doc, cfg);

  logger.info(`[Cab Broadcast] ${doc.reference}: dispatched to ${drivers.length} matching driver(s)`, {
    action: 'cab.dispatch',
    tenantId: String(doc.propertyId),
    metadata: {
      reference: doc.reference,
      vehicleType: doc.vehicleType,
      homestay: doc.homestayName,
      matchingDriversCount: drivers.length,
      driverIds: drivers.map((d) => String(d._id)),
      maxBroadcastCap: cfg.driverBroadcastMax,
    },
  });

  await pushUsers(isDemo, drivers.map((d) => d._id), {
    title: 'New trip request',
    body: `${doc.vehicleType || 'Cab'} from ${doc.homestayName || 'a homestay'}. Send your quote.`,
    data: tripData(doc, 'NEW_REQUEST'),
  });

  if (cfg.driverBroadcastMax <= 0) return;
  // the homestay's own drivers already got their own link (notifyNewRequest): no second message
  const ownPhones = new Set((await ownDriversOf(String(doc.propertyId))).map((d: any) => last10(d.phone)));
  await Promise.allSettled(
    drivers
      .filter((d) => d.phone && d.whatsappAlerts !== false && !ownPhones.has(last10(d.phone)))
      .slice(0, cfg.driverBroadcastMax)
      .map((d) => whatsapp(isDemo, d.phone, messages.newRequestMessage(doc, driverQuoteLink(isDemo, d._id, doc.reference))))
  );
}

async function transition(isDemo: boolean, filter: Record<string, any>, set: Record<string, any>, notFound: string, extra: Record<string, any> = {}) {
  const updated = await cabModel(isDemo).findOneAndUpdate(filter, { $set: set, ...extra }, { returnDocument: 'after' });
  if (!updated) throw conflict(notFound);
  return updated;
}

const MAX_PIN_ATTEMPTS = 5;

export async function startTrip(isDemo: boolean, filter: Record<string, any>, actor: string, otp?: string, requireOtp = true) {
  // Idempotency: if already started (e.g. offline queue replay or earlier sync), return cleanly
  const alreadyStarted: any = await cabModel(isDemo).findOne({ ...filter, status: 'TRIP_STARTED' }).lean();
  if (alreadyStarted) return alreadyStarted;

  // Only after the advance is paid (CONFIRMED or transit status).
  const startableStatuses = ['CONFIRMED', 'EN_ROUTE_PICKUP', 'ARRIVED_HOMESTAY'];
  const doc: any = await cabModel(isDemo).findOne({ ...filter, status: { $in: startableStatuses }, advancePaid: true, needsReassignment: { $ne: true } }).lean();
  if (!doc) throw conflict('Trip can start only after the advance is paid and a driver is assigned.');

  if (requireOtp) {
    // Each guess first takes one of MAX_PIN_ATTEMPTS atomically, so parallel guesses can't exceed it.
    const slot = await cabModel(isDemo).updateOne({ _id: doc._id, pickupOtpAttempts: { $not: { $gte: MAX_PIN_ATTEMPTS } } }, { $inc: { pickupOtpAttempts: 1 } });
    if (!slot.modifiedCount) throw httpError(429, 'Too many wrong PINs. Please contact the homestay to start this trip.', 'PIN_LOCKED');
    if (!doc.pickupOtp || !otp || String(otp).trim() !== String(doc.pickupOtp).trim()) {
      throw httpError(400, 'Invalid Boarding Verification PIN. Please ask the passenger for their 4-digit PIN.');
    }
  }

  const updated = await transition(
    isDemo,
    { _id: doc._id, status: { $in: startableStatuses }, advancePaid: true, needsReassignment: { $ne: true } },
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
  if (doc.status === 'COMPLETED') return doc; // Idempotency: already completed
  const s = doc.financialSnapshot;
  const driverShare = s ? s.advanceAmount - s.platformFeeAmount - s.homestayCommissionAmount : 0;
  const updated = await transition(
    isDemo,
    { _id: doc._id, status: 'TRIP_STARTED' },
    { status: 'COMPLETED', completedAt: new Date(), driverSettlementStatus: driverShare > 0 ? 'PENDING' : 'NONE' },
    'Only a started trip can be completed.'
  );

  // Auto-update driver location to destination landmark coordinates (Zero-permission drop-off tracking)
  if (mongoose.Types.ObjectId.isValid(updated.assignedDriverUserId)) {
    const dropLoc = resolveDestinationCoordinates(updated);
    if (dropLoc) {
      await userModel(isDemo).updateOne(
        { _id: updated.assignedDriverUserId },
        {
          $set: {
            location: dropLoc,
            locationPoint: { type: 'Point', coordinates: [dropLoc.lng, dropLoc.lat] },
            locationUpdatedAt: new Date(),
          },
        }
      ).catch(() => {});
    }
  }

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
  const windowMin = cfg.quoteBiddingWindowMin ?? ((cfg.quoteWindowHours || 4) * 60);
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

    // Discard quotes from drivers who are currently driving on an active ride (TRIP_STARTED)
    const onRideTrips: any[] = await Cab.find({
      status: 'TRIP_STARTED',
      assignedDriverUserId: { $exists: true, $ne: null },
    }).select('assignedDriverUserId').lean();
    const busyDriverIds = new Set(onRideTrips.map((t: any) => String(t.assignedDriverUserId)));

    // Section 2 Driver Selection Rules: Priority Tier (Own Drivers) vs Fallback Tier (Mountain Pool)
    const last10 = (p: string) => String(p || '').replace(/\D/g, '').slice(-10);
    const ownPhones = new Set<string>();
    try {
      const store = await tenantManager.load(String(doc.propertyId));
      for (const d of store.drivers || []) {
        if (d.active && d.phone) ownPhones.add(last10(d.phone));
      }
    } catch {}

    const isOwn = (q: any) => Boolean(q.isOwnDriver || (q.driverPhone && ownPhones.has(last10(q.driverPhone))));
    // Skip blocked drivers, quotes with an open counter-offer (the owner did not agree to that fare),
    // and drivers who already hold a trip close to this pickup.
    const inactive = await inactiveDrivers(isDemo, pendingQuotes.map((q: any) => q.driverId));
    const eligible: any[] = [];
    for (const q of pendingQuotes) {
      const id = String(q.driverId);
      if (busyDriverIds.has(id) || inactive.has(id) || q.counterFare) continue;
      if (await driverHasOverlap(isDemo, id, doc)) continue;
      eligible.push(q);
    }
    const availableOwnQuotes = eligible.filter(isOwn);
    const availablePoolQuotes = eligible.filter((q: any) => !isOwn(q));

    let winningQuote: any = null;

    if (availableOwnQuotes.length > 0) {
      // Priority Tier: Own homestay drivers win automatically. If tied, higher rating wins, then earliest quote.
      availableOwnQuotes.sort((a: any, b: any) => {
        if (a.quotedFare !== b.quotedFare) return a.quotedFare - b.quotedFare;
        const rA = Number(a.driverRating || 0);
        const rB = Number(b.driverRating || 0);
        if (rA !== rB) return rB - rA;
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });
      winningQuote = availableOwnQuotes[0];
    } else if (availablePoolQuotes.length > 0) {
      // Fallback Tier: Lowest pool quote wins. If tied, higher rating wins, then earliest quote.
      availablePoolQuotes.sort((a: any, b: any) => {
        if (a.quotedFare !== b.quotedFare) return a.quotedFare - b.quotedFare;
        const rA = Number(a.driverRating || 0);
        const rB = Number(b.driverRating || 0);
        if (rA !== rB) return rB - rA;
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });
      winningQuote = availablePoolQuotes[0];
    }

    const pick = {
      ref: doc.reference, isDemo, pendingQuotes: pendingQuotes.length, eligible: eligible.length, ownEligible: availableOwnQuotes.length,
      winner: winningQuote ? { driverId: String(winningQuote.driverId), fare: winningQuote.quotedFare, own: isOwn(winningQuote) } : null,
    };
    // no winner = still open, retried on every list view: only the decision is logged, not each retry
    if (!winningQuote) continue;
    logger.info(`[Cab] ${doc.reference}: bidding closed, auto-selecting ₹${winningQuote.quotedFare}`, {
      action: 'cab.bidding_closed',
      tenantId: String(doc.propertyId),
      metadata: pick,
    });

    try {
      await ownerConfirmQuote(
        String(doc.propertyId),
        isDemo,
        doc.reference,
        String(winningQuote.driverId),
        isOwn(winningQuote) ? 'system:priority-own-driver' : 'system:lowest-pool-bid'
      );
      await Cab.updateOne({ _id: doc._id }, { $set: { autoAccepted: true } });
      autoSelectedCount++;
    } catch (err: any) {
      logger.warn(`[autoSelectLowestQuotes] ${doc.reference}: auto-select failed: ${err?.message}`, { action: 'cab.auto_select_failed', tenantId: String(doc.propertyId), metadata: pick });
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
    status: 'TRIP_STARTED',
    advancePaid: true,
  }).limit(50).lean();

  let completedCount = 0;
  const AUTO_COMPLETE_BUFFER_MS = 8 * HOUR_MS; // Auto-complete buffer: 8 hours after pickup
  for (const doc of candidates) {
    const tripTimestamp = istDateTime(doc.date, doc.time) ?? Number(doc.date);
    if (tripTimestamp + AUTO_COMPLETE_BUFFER_MS <= now) {
      try {
        const s = doc.financialSnapshot;
        const driverShare = s ? s.advanceAmount - s.platformFeeAmount - s.homestayCommissionAmount : 0;
        const updated = await Cab.findOneAndUpdate(
          { _id: doc._id, status: 'TRIP_STARTED', advancePaid: true },
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
          // Auto-update driver location to destination landmark coordinates
          if (mongoose.Types.ObjectId.isValid(updated.assignedDriverUserId)) {
            const dropLoc = resolveDestinationCoordinates(updated);
            if (dropLoc) {
              await userModel(isDemo).updateOne(
                { _id: updated.assignedDriverUserId },
                {
          $set: {
            location: dropLoc,
            locationPoint: { type: 'Point', coordinates: [dropLoc.lng, dropLoc.lat] },
            locationUpdatedAt: new Date(),
          },
        }
              ).catch(() => {});
            }
          }
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
      { biddingClosesAt: null, createdAt: { $lte: new Date(now.getTime() - 240 * 60000) } },
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

    const directLink = driverQuoteLink(isDemo, linkDriverId(doc), doc.reference);

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

    await audit('system:completion-reminder', 'cab.completion_reminder', 'CabRequest', String(doc._id), { reference: doc.reference, driverPhone: maskPhone(doc.assignedDriverPhone) }, isDemo, scope(updated));
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
  const open = { reference, propertyId: tenantKey, status: { $in: OPEN_STATUSES } };
  // validated in the write itself: a counter equal to the driver's fare is never stored
  const updated: any = await cabModel(isDemo).findOneAndUpdate(
    { ...open, quotes: { $elemMatch: { driverId, status: 'PENDING', quotedFare: { $ne: fare } } } },
    { $set: { 'quotes.$.counterFare': fare, 'quotes.$.counterAt': new Date() } },
    { returnDocument: 'after' }
  );
  if (!updated) {
    if (await cabModel(isDemo).exists({ ...open, quotes: { $elemMatch: { driverId, status: 'PENDING', quotedFare: fare } } })) {
      throw httpError(400, 'That is the driver\'s own fare: confirm the quote instead.');
    }
    throw conflict('This quote is no longer open. Refresh and try again.');
  }
  const q = updated.quotes.find((x: any) => String(x.driverId) === String(driverId));
  await audit(actor, 'cab.counter_offer', 'CabRequest', String(updated._id), { reference, driverId, fare, quoted: q.quotedFare }, isDemo, scope(updated));
  await Promise.allSettled([
    pushUsers(isDemo, [driverId], { title: 'Counter-offer', body: `The homestay offers ₹${fare.toLocaleString('en-IN')} for trip ${reference}.`, data: tripData(updated, 'QUOTE_COUNTER') }),
    whatsapp(isDemo, q.driverPhone, messages.quoteCounterMessage(q.driverName, reference, fare, driverQuoteLink(isDemo, driverId, reference)), { tenantId: tenantKey, driverId }),
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
  // The owner already agreed to this fare: confirm the trip on their behalf. The fare change is part
  // of the confirm write, so a failed confirm leaves the driver's own quote untouched.
  return ownerConfirmQuote(String(doc.propertyId), isDemo, reference, driverId, `driver:${driverId}:accepted-counter`, q.counterFare);
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
    if (await driverHasOverlap(isDemo, String(driver._id), doc)) throw conflict(`${driver.name} already has another trip within 3 hours of this pickup.`);
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
      { ...priced, status: 'AWAITING_ADVANCE_PAYMENT', advanceDueAt: dueAt(cfg), paymentLinkId: '', paymentLinkUrl: '', paymentClaim: null, ownFleet: false, ownDriverId: null, ...driverFields },
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
      { $set: { ...mine, 'quotes.$[o].status': 'REJECTED', 'quotes.$[o].outbid': true } },
      { arrayFilters: [...(driverUserId ? [{ 'q.driverId': driverUserId, 'q.status': 'PENDING' }] : []), { 'o.driverId': { $ne: driverUserId }, 'o.status': 'PENDING' }] }
    );
  }
  const pushes: Promise<unknown>[] = [];
  if (driverUserId && driverUserId !== previous) {
    pushes.push(pushUsers(isDemo, [driverUserId], { title: 'New trip assigned', body: `You were assigned trip ${doc.reference}.`, data: tripData(doc, 'TRIP_ASSIGNED') }));
  }
  if (previous && previous !== driverUserId) {
    pushes.push(pushUsers(isDemo, [previous], { title: 'Trip reassigned', body: `Trip ${doc.reference} was given to another driver.`, data: tripData(doc, 'DRIVER_REMOVED') }));
  }
  if (declined.length) pushes.push(pushUsers(isDemo, declined, { title: 'Trip taken', body: `Trip ${doc.reference} was given to another driver.`, data: tripData(doc, 'DRIVER_REMOVED') }));
  if (reassign) {
    // Advance already paid: the new driver and the guest get each other's details now, the owner is told
    pushes.push(
      whatsapp(isDemo, phone, messages.advancePaidDriverMessage(updated, driverQuoteLink(isDemo, linkDriverId(updated), updated.reference))),
      confirmGuestWhatsApp(isDemo, updated),
      pushOwner(isDemo, String(doc.propertyId), { title: 'New driver assigned', body: `Assigned ${name} to trip ${doc.reference}.`, data: tripData(updated, 'TRIP_ASSIGNED') })
    );
  } else {
    // A new fare means a new advance: give the guest a way to pay it; WhatsApp-only drivers hear it too
    pushes.push(whatsapp(isDemo, phone, messages.quoteAcceptedDriverMessage(name, doc.reference), scope(updated)), requestAdvance(String(doc.propertyId), isDemo, updated));
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

// ponytail: fixed grace; a fake "I paid" claim holds the driver at most this long. Make it an admin setting if 12h is wrong.
export const CLAIM_GRACE_MS = 12 * HOUR_MS;

/** UPI transaction reference (UTR / RRN): 12 digits, spaces people paste with it dropped. null when invalid. */
export function parseUtr(v: unknown): string | null {
  const s = String(v ?? '').replace(/\s/g, '');
  return /^\d{12}$/.test(s) ? s : null;
}

/**
 * The guest says they paid by UPI and typed the UTR. Kept on the request for the admin to verify (record payment or
 * reject). The first claim moves the release time to now + CLAIM_GRACE_MS so the driver is not released while the admin
 * checks; a correction while it is pending keeps that time, so resubmitting never extends the hold.
 */
export async function submitPaymentClaim(isDemo: boolean, doc: any, utrInput: unknown) {
  const utr = parseUtr(utrInput);
  if (!utr) throw httpError(400, 'Enter the 12-digit UPI reference (UTR) number shown in your payment app.');
  const Model = cabModel(isDemo);
  // ponytail: check-then-write like settlePayout; two trips claiming one UTR at the same instant both pass (admin still verifies each).
  if (await Model.exists({ $or: [{ advancePaymentId: utr }, { _id: { $ne: doc._id }, 'paymentClaim.utr': utr, 'paymentClaim.status': 'PENDING' }] })) {
    throw conflict('This UTR is already used for another payment. Check the number in your payment app.');
  }
  const corrected = doc.paymentClaim?.status === 'PENDING';
  const now = Date.now();
  // no due date = the admin set no payment window: nothing to extend
  const due = corrected || !doc.advanceDueAt ? doc.advanceDueAt ?? null : new Date(Math.max(new Date(doc.advanceDueAt).getTime(), now + CLAIM_GRACE_MS));
  const updated = await transition(
    isDemo,
    { _id: doc._id, status: 'AWAITING_ADVANCE_PAYMENT', advancePaid: { $ne: true }, advanceAmount: doc.advanceAmount },
    { paymentClaim: { utr, amount: doc.advanceAmount, submittedAt: new Date(now), status: 'PENDING', reason: '', decidedAt: null }, advanceDueAt: due },
    'This trip is not waiting for an advance payment any more.'
  );
  const masked = maskPhone(doc.guestPhone);
  await audit('guest', 'payment.claim', 'CabRequest', String(doc._id), { ref: doc.reference, utr, amount: doc.advanceAmount, corrected, previousUtr: corrected ? doc.paymentClaim.utr : undefined, holdUntil: due }, isDemo, { ...scope(updated), actorRole: 'CUSTOMER', actorName: masked });
  if (!corrected) {
    await pushOwner(isDemo, String(doc.propertyId), {
      title: 'Guest says advance paid',
      body: `Trip ${doc.reference}: the guest says they paid ₹${Number(doc.advanceAmount).toLocaleString('en-IN')}. We are confirming the payment.`,
      data: tripData(updated, 'ADVANCE_CLAIMED'),
    }).catch(() => {});
  }
  return updated;
}

/** Admin could not find the guest's payment: the claim is closed with a reason the guest sees, and a normal payment window starts now. */
export async function adminRejectPaymentClaim(isDemo: boolean, id: string, reason: unknown, actor: string) {
  const why = String(reason || '').trim().slice(0, 300);
  const cfg = await cfgOf(isDemo);
  const updated = await transition(
    isDemo,
    { _id: id, status: 'AWAITING_ADVANCE_PAYMENT', advancePaid: { $ne: true }, 'paymentClaim.status': 'PENDING' },
    { 'paymentClaim.status': 'REJECTED', 'paymentClaim.reason': why, 'paymentClaim.decidedAt': new Date(), advanceDueAt: dueAt(cfg) },
    'There is no pending payment claim on this request.'
  );
  await audit(actor, 'payment.claim_rejected', 'CabRequest', id, { ref: updated.reference, utr: updated.paymentClaim?.utr, amount: updated.paymentClaim?.amount, reason: why, advanceDueAt: updated.advanceDueAt }, isDemo, scope(updated));
  return updated;
}

/**
 * The one way an advance becomes paid (admin by hand, or the gateway webhook): CONFIRMED, phones released.
 * Conditional on the request still waiting for exactly this amount, so a release, cancel or second
 * payment in between makes it fail instead of double-applying.
 */
async function applyAdvancePayment(isDemo: boolean, doc: any, p: { transactionId: string; method: string; amount: number; note: string; actor: string }) {
  const Model = cabModel(isDemo);
  if (await Model.exists({ advancePaymentId: p.transactionId })) throw conflict('This transaction ID is already recorded on another request.');
  const pickupOtp = doc.pickupOtp || String(crypto.randomInt(1000, 10000));
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
        paymentClaim: null,
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
    whatsapp(isDemo, updated.assignedDriverPhone, messages.advancePaidDriverMessage(updated, driverQuoteLink(isDemo, linkDriverId(updated), updated.reference))),
    confirmGuestWhatsApp(isDemo, updated),
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
      // ...unless it was this very payment, recorded by a concurrent retry of the same webhook
      const now: any = await Model.findById(doc._id).select('advancePaymentId').lean();
      if (now?.advancePaymentId === paymentId) return 'DUPLICATE';
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
    // not locked in a driver payout request: that payout pays it (settling both would pay twice)
    { _id: id, status: 'COMPLETED', driverSettlementStatus: 'PENDING', driverPayoutId: null },
    { driverSettlementStatus: 'SETTLED', driverSettlementRef: ref, driverSettledAt: new Date() },
    'No pending driver settlement on this request (or it is part of an open driver payout request).'
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
  // one bank transfer pays one payout: a UTR already on another settled payout is a typo or a double payment.
  // ponytail: check-then-write, two admins settling at the same instant with one UTR both pass; a unique partial index needs old duplicates cleaned first.
  if (await Payout.exists({ _id: { $ne: payout._id }, status: 'SETTLED', utrNumber: utr })) {
    throw conflict('This UTR / reference is already used on another settled payout.');
  }

  const isDriver = payout.recipientType === 'DRIVER';
  // Verify every locked request still belongs to this payout and its total matches before paying.
  const locked = isDriver
    ? await cabModel(isDemo).find({ driverPayoutId: String(payout._id) }).select('financialSnapshot.driverShareOfAdvance driverSettlementStatus').lean()
    : await cabModel(isDemo).find({ hostPayoutId: String(payout._id) }).select('financialSnapshot.homestayCommissionAmount').lean();

  const total = isDriver
    ? locked.reduce((a: number, d: any) => a + (d.financialSnapshot?.driverShareOfAdvance || 0), 0)
    : locked.reduce((a: number, d: any) => a + (d.financialSnapshot?.homestayCommissionAmount || 0), 0);

  if (locked.length !== (payout.cabRequestIds || []).length || total !== payout.amount) {
    throw conflict('Payout does not match its locked trips. Reject it and ask to request again.');
  }
  // a trip already settled on its own (before the lock existed) must not be paid again
  if (isDriver && payout.status === 'PENDING' && locked.some((d: any) => d.driverSettlementStatus === 'SETTLED')) {
    throw conflict('A trip in this payout was already settled separately. Reject it and ask to request again.');
  }

  const updated = await Payout.findOneAndUpdate(
    { _id: payout._id, status: 'PENDING' },
    { $set: { status: 'SETTLED', utrNumber: utr, notes: String(notes || '').slice(0, 500), settledAt: new Date(), decidedBy: actor } },
    { returnDocument: 'after' }
  );
  const settled = updated || await Payout.findById(payout._id).lean();
  if (!settled || settled.status !== 'SETTLED' || settled.utrNumber !== utr) {
    throw conflict('Payout is not pending (already settled or rejected).');
  }

  if (isDriver) {
    await cabModel(isDemo).updateMany({ driverPayoutId: String(payout._id) }, { $set: { driverSettlementStatus: 'SETTLED' } });
    await audit(actor, 'driver.payout.settle', 'PayoutRequest', id, { utr, amount: payout.amount, driverId: payout.driverId }, isDemo);
    if (updated && payout.driverPhone) {
      await whatsapp(isDemo, payout.driverPhone, messages.driverPayoutSettledMessage(payout.amount, utr), { driverId: String(payout.driverId) }).catch(() => {});
    }
  } else {
    await audit(actor, 'payout.settle', 'PayoutRequest', id, { utr, amount: payout.amount, tenantKey: payout.tenantId }, isDemo);
    if (updated) await pushOwner(isDemo, payout.tenantId, { title: 'Payout sent', body: `₹${payout.amount.toLocaleString('en-IN')} was paid out (UTR ${utr}).`, data: { type: 'PAYOUT_SETTLED' } });
  }

  return settled;
}

export async function rejectPayout(isDemo: boolean, id: string, reason: unknown, actor: string) {
  const why = String(reason || '').trim().slice(0, 300);
  if (!why) throw httpError(400, 'A reason is required.');
  const Payout = payoutModel(isDemo);
  const payout: any = await Payout.findById(id).lean();
  if (!payout) throw httpError(404, 'Payout not found.');

  const isDriver = payout.recipientType === 'DRIVER';
  const unlock = () =>
    isDriver
      ? cabModel(isDemo).updateMany({ driverPayoutId: String(id) }, { $set: { driverPayoutId: null } })
      : cabModel(isDemo).updateMany({ hostPayoutId: String(id) }, { $set: { hostPayoutId: null } });

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

  if (isDriver) {
    await audit(actor, 'driver.payout.reject', 'PayoutRequest', id, { reason: why, amount: updated.amount, driverId: updated.driverId }, isDemo);
    if (updated.driverPhone) {
      await whatsapp(isDemo, updated.driverPhone, messages.driverPayoutRejectedMessage(updated.amount, why), { driverId: String(updated.driverId) }).catch(() => {});
    }
  } else {
    await audit(actor, 'payout.reject', 'PayoutRequest', id, { reason: why, amount: updated.amount }, isDemo, { tenantId: String(updated.tenantId) });
    await pushOwner(isDemo, updated.tenantId, { title: 'Payout request rejected', body: why, data: { type: 'PAYOUT_REJECTED' } });
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Driver Wallet & Payout Operations
// ---------------------------------------------------------------------------
const eligibleDriverFilter = (driverId: string) => ({
  assignedDriverUserId: driverId,
  status: 'COMPLETED',
  advancePaid: true,
  driverSettlementStatus: 'PENDING',
  driverPayoutId: null,
  'financialSnapshot.driverShareOfAdvance': { $gt: 0 },
});

export async function releaseStaleDriverLocks(isDemo: boolean, driverId: string) {
  const Cab = cabModel(isDemo);
  const lockedTo: string[] = (await Cab.distinct('driverPayoutId', { assignedDriverUserId: driverId, driverPayoutId: { $ne: null } })).map(String);
  if (!lockedTo.length) return;
  const live = await payoutModel(isDemo)
    .find({ _id: { $in: lockedTo.filter((x) => mongoose.Types.ObjectId.isValid(x)) }, status: { $ne: 'REJECTED' } })
    .select('_id')
    .lean();
  const liveIds = new Set(live.map((p: any) => String(p._id)));
  const dead = lockedTo.filter((x) => !liveIds.has(x));
  if (dead.length) await Cab.updateMany({ assignedDriverUserId: driverId, driverPayoutId: { $in: dead } }, { $set: { driverPayoutId: null } });
}

export async function driverPayoutSummary(driverId: string, isDemo: boolean) {
  await releaseStaleDriverLocks(isDemo, driverId);
  const [eligible, pending, history] = await Promise.all([
    cabModel(isDemo).find(eligibleDriverFilter(driverId)).select('reference date time financialSnapshot.driverShareOfAdvance').lean(),
    payoutModel(isDemo).findOne({ driverId, recipientType: 'DRIVER', status: 'PENDING' }).lean(),
    payoutModel(isDemo).find({ driverId, recipientType: 'DRIVER' }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  const available = eligible.reduce((a: number, d: any) => a + (d.financialSnapshot?.driverShareOfAdvance || 0), 0);
  return {
    available,
    eligibleTrips: eligible.length,
    trips: eligible.map((d: any) => ({
      reference: d.reference,
      date: d.date,
      time: d.time,
      amount: d.financialSnapshot?.driverShareOfAdvance || 0,
    })),
    pendingPayout: pending ? { id: String((pending as any)._id), amount: (pending as any).amount, requestedAt: (pending as any).requestedAt } : null,
    history: history.map((p: any) => ({
      id: String(p._id),
      amount: p.amount,
      status: p.status,
      method: p.method,
      upiId: p.upiId,
      settlementReference: p.utrNumber,
      requestedAt: p.requestedAt || p.createdAt,
      settledAt: p.settledAt,
      rejectionReason: p.rejectionReason,
    })),
  };
}

/** The UPI / bank of this driver's last settled payout (the only destination a quote link may use). */
async function savedDriverPayoutMethod(isDemo: boolean, driverId: string) {
  const last: any = await payoutModel(isDemo)
    .findOne({ driverId, recipientType: 'DRIVER', status: 'SETTLED' })
    .sort({ settledAt: -1 })
    .select('method upiId bank')
    .lean();
  if (!last || (last.method === 'UPI' ? !last.upiId : !last.bank?.accountNumber)) {
    throw httpError(400, 'Add your UPI in the StayRide app or contact support to set it up.', 'NO_SAVED_PAYOUT_METHOD');
  }
  return { method: last.method as 'UPI' | 'BANK_TRANSFER', upiId: last.upiId || undefined, bank: last.bank || undefined };
}

export async function requestDriverPayout(
  driverId: string,
  driver: { name?: string; phone?: string },
  isDemo: boolean,
  body: any,
  actor: string,
  savedMethodOnly = false
) {
  // savedMethodOnly (quote link, often forwarded): pay only to where this driver was paid before
  const { method, upiId, bank } = savedMethodOnly ? await savedDriverPayoutMethod(isDemo, driverId) : parsePayoutMethod(body);
  const Cab = cabModel(isDemo);
  const Payout = payoutModel(isDemo);
  const cfg = await cfgOf(isDemo);
  await releaseStaleDriverLocks(isDemo, driverId);

  const pending: any = await Payout.findOne({ driverId, recipientType: 'DRIVER', status: 'PENDING' }).lean();
  if (pending) {
    const lockedCount = await Cab.countDocuments({ driverPayoutId: String(pending._id) });
    const ageMs = Date.now() - new Date(pending.requestedAt).getTime();
    if (lockedCount === 0 && ageMs > 60_000) {
      await Payout.deleteOne({ _id: pending._id, status: 'PENDING' });
    } else {
      throw conflict('You already have a payout request pending.');
    }
  }

  const eligible = await Cab.find(eligibleDriverFilter(driverId)).select('_id tripId reference financialSnapshot.driverShareOfAdvance').lean();
  const amount = eligible.reduce((a: number, d: any) => a + (d.financialSnapshot?.driverShareOfAdvance || 0), 0);
  const threshold = cfg.minDriverPayoutThreshold;
  if (amount <= 0) throw httpError(400, 'You have no eligible earnings to withdraw yet.');
  if (amount < threshold) {
    throw httpError(400, `Minimum payout balance required is ₹${threshold}. Your current balance is ₹${amount}.`);
  }
  if (body.expectedAmount !== undefined && Number(body.expectedAmount) !== amount) {
    throw conflict(`Your balance changed to ₹${amount.toLocaleString('en-IN')}. Please review and request again.`);
  }

  const payoutId = new mongoose.Types.ObjectId();
  try {
    await Payout.create({
      _id: payoutId,
      recipientType: 'DRIVER',
      driverId,
      driverName: driver.name || 'Driver',
      driverPhone: driver.phone || '',
      homestayName: 'Driver Wallet',
      ownerName: driver.name || 'Driver',
      ownerPhone: driver.phone || '',
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

  const ids = eligible.map((d: any) => d._id);
  const lock = await Cab.updateMany({ _id: { $in: ids }, driverPayoutId: null }, { $set: { driverPayoutId: String(payoutId) } });
  if (lock.modifiedCount !== ids.length) {
    await Cab.updateMany({ driverPayoutId: String(payoutId) }, { $set: { driverPayoutId: null } });
    await Payout.deleteOne({ _id: payoutId, status: 'PENDING' });
    throw conflict('Your balance changed. Please try again.');
  }

  await audit(actor, 'driver.payout.request', 'PayoutRequest', String(payoutId), { driverId, amount, count: ids.length }, isDemo);
  return Payout.findById(payoutId).lean();
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
  if (!updated) throw conflict('Only a completed trip can be rated, and only once.');
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
  if (status === 'BLOCKED') await releaseDriverTrips(isDemo, driverUserId, actor, 'Your driver account was blocked. Please contact support.');
  if (status === 'PENDING_APPROVAL') await releaseDriverTrips(isDemo, driverUserId, actor, 'Your driver account is under review again. Your upcoming trips were released.');
  if (status === 'ACTIVE') {
    await pushUsers(isDemo, [driverUserId], { title: 'You are approved', body: 'Your driver account is active. You can now quote on trips.', data: { type: 'DRIVER_APPROVED' } });
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
  const removedMsg = (d: any) => ({ title: 'Driver removed', body: `The driver for trip ${d.reference} is no longer available. Arranging another driver.`, data: tripData(d, 'DRIVER_REMOVED') });

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
    // only quotes that lost to this driver come back (and only an active driver's); his own is dropped
    const quotes = (d.quotes || []).map((q: any) =>
      q.status === 'REJECTED' && q.outbid && active.has(String(q.driverId))
        ? { ...q, status: 'PENDING', outbid: false }
        : ['PENDING', 'ACCEPTED'].includes(q.status) ? { ...q, status: 'REJECTED' } : q
    );
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
          paymentClaim: null,
        },
        $addToSet: { previousDriverUserIds: id },
      },
      { returnDocument: 'after' }
    );
    if (updated) {
      released.push(updated);
      await cancelPaymentLink(d.paymentLinkId);
    }
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
