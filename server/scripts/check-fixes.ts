// Run: npx tsx scripts/check-fixes.ts
// Pure-logic checks for the trip fixes (no database, nothing is sent).
import './no-telemetry.js'; // must stay the first import
import assert from 'node:assert/strict';
import { maskPhone, pickupsOverlap, OVERLAP_MS, linkDriverId, linkDriverFilter, driverTripView, istDateTime, areaMatches, nearbyPasses, nearbyNotifyTime, OWN_FIRST_MS, vehicleFits, autoCompleteKind, heldByFilter, driverKey, walletTrips, isOwnQuote, parseUtr, CLAIM_GRACE_MS, askCabBlocked, askCabConfirmText, askCabByLabel, askCabLine, askCabPrior, pushAskCab, currentBookingOf, ASK_CAB_KEEP, stayOrder } from '../src/stayride/platform.js';
import { askCabStatusFrom, opaqueData, readOpaqueData } from '../src/services/whatsapp.service.js';
import { dueAt, keepClaim, UNVERIFIED_CLAIM } from '../src/stayride/platform.js';
import { resolvePlatformConfig } from '../src/services/platform-config.js';
import { tenantRoomView } from '../src/services/room.service.js';
import { CommissionService } from '../src/services/commission.service.js';
import { ownFleetFee } from '../src/services/platform-config.js';
import { upiPayUrl, isUtr, UPI_NOTE_MAX } from '../../client-side/lib/upi.ts';
import { formatNightly } from '../../client-side/lib/booking.ts';
import { publicConfig } from '../src/services/platform-config.js';
import { applyFeed, isOwnerBlock, isCompleteIcs, buildIcs, syncSummary } from '../src/stayride/ical.js';
import { guestLinkExpiry, autoAskCabDue, askCabResendOk } from '../src/stayride/platform.js';
import { toWhatsAppNumber } from '../src/services/whatsapp.service.js';
import { StayRideMemoryStore } from '../src/stayride/store.js';
import { normTxnId, unmatchedReuse, claimHoldUntil, CLAIM_PICKUP_CAP_MS, eligibleFilter, eligibleDriverFilter } from '../src/stayride/platform.js';
import { safeUrl } from '../src/utils/logger.js';
import sift from 'sift'; // mongoose's own query matcher: evaluates the real payout filters against plain trips

// driver phone masked from digits only, last 4 kept, whatever the formatting
for (const p of ['9832012345', '+91 98320 12345', '098320-12345']) assert.equal(maskPhone(p), '******2345');
assert.equal(maskPhone(''), '');
assert.ok(!maskPhone('+91 98320 12345').includes('9832'));

// 3h overlap window around pickup
const at = istDateTime(Date.UTC(2026, 10, 1), '09:00 AM')!;
assert.ok(pickupsOverlap(at, istDateTime(Date.UTC(2026, 10, 1), '11:30 AM')));
assert.ok(!pickupsOverlap(at, istDateTime(Date.UTC(2026, 10, 1), '12:00 PM')));
assert.ok(!pickupsOverlap(at, at + OVERLAP_MS));
assert.ok(!pickupsOverlap(at, null));

// own-fleet drivers get `own-<id>` links, and their trips are found by them
assert.equal(linkDriverId({ assignedDriverUserId: null, ownFleet: true, ownDriverId: 7 }), 'own-7');
assert.equal(linkDriverId({ assignedDriverUserId: 'abc' }), 'abc');
assert.deepEqual(linkDriverFilter('own-7'), { $or: [{ assignedDriverUserId: 'own-7' }, { ownFleet: true, ownDriverId: 7 }] });
assert.deepEqual(linkDriverFilter('abc'), { assignedDriverUserId: 'abc' });

// driver view: PIN never sent to the driver; a lost (not cancelled) trip is TAKEN
const trip = { reference: 'R', status: 'CONFIRMED', advancePaid: true, pickupOtp: '1234', guestPhone: '9111111111', assignedDriverUserId: 'd1', quotes: [{ driverId: 'd2', status: 'REJECTED' }] };
const mine = driverTripView(trip, 'd1');
assert.equal(mine.driverView, 'ASSIGNED');
assert.ok(!('pickupOtp' in mine));
assert.equal(mine.pickupOtpRequired, true);
assert.equal(driverTripView(trip, 'd2').driverView, 'TAKEN');
assert.equal(driverTripView({ ...trip, status: 'CANCELLED' }, 'd2').driverView, 'CANCELLED');
assert.equal(driverTripView({ ...trip, assignedDriverUserId: null, ownFleet: true, ownDriverId: 7 }, 'own-7').driverView, 'ASSIGNED');

// no-GPS driver passes the radius only when based in the homestay's area (case / spaces ignored)
assert.ok(areaMatches('  Gangtok ', 'gangtok'));
assert.ok(!areaMatches('', ''));
assert.ok(!areaMatches('Siliguri', 'Gangtok'));
assert.ok(nearbyPasses(null, 40, 'Gangtok', 'GANGTOK'));
assert.ok(!nearbyPasses(null, 40, 'Siliguri', 'Gangtok'));
assert.ok(!nearbyPasses(null, 40, '', 'Gangtok'));
assert.ok(nearbyPasses(12, 40, '', ''));
assert.ok(!nearbyPasses(55, 40, 'Gangtok', 'Gangtok'));
assert.ok(nearbyPasses(null, 0, '', '')); // radius 0 = no filter

// own drivers first: nearby waits 10 min, unless no own drivers or pickup is under 2h away
const now = Date.UTC(2026, 10, 1, 4, 0);
assert.equal(nearbyNotifyTime(now + 5 * 3600000, now, true)?.getTime(), now + OWN_FIRST_MS);
assert.equal(OWN_FIRST_MS, 10 * 60000);
assert.equal(nearbyNotifyTime(now + 5 * 3600000, now, false), null);
assert.equal(nearbyNotifyTime(now + 90 * 60000, now, true), null);
assert.ok(nearbyNotifyTime(now + 2 * 3600000, now, true));

// one vehicle rule for notify and list
assert.ok(vehicleFits({ type: 'SUV' }, { vehicleType: 'SUV', passengers: 3 }));
assert.ok(!vehicleFits({ type: 'Sedan' }, { vehicleType: 'SUV', passengers: 3 }));
assert.ok(vehicleFits({}, { vehicleType: 'SUV', passengers: 3 })); // type not set: sees everything
assert.ok(vehicleFits({ type: 'MUV' }, { vehicleType: 'SUV', passengers: 6 })); // 5+ pax: any 6-7 seater
assert.ok(!vehicleFits({ type: 'Sedan', seats: 7 }, { vehicleType: 'SUV', passengers: 6 }));
assert.ok(vehicleFits({ type: 'Fleet', seats: 8 }, { vehicleType: 'SUV', passengers: 6 }));
assert.ok(!vehicleFits({ type: 'Fleet', seats: 4 }, { vehicleType: 'SUV', passengers: 6 }));

// UTR: 12 digits, pasted spaces dropped; server and guest page agree
assert.equal(parseUtr(' 4123 4567 8901 '), '412345678901');
for (const bad of ['41234567890', '4123456789012', 'ABC123456789', '', null, '41234567890a']) assert.equal(parseUtr(bad), null);
assert.ok(isUtr('4123 4567 8901'));
assert.ok(!isUtr('41234567890'));
assert.equal(CLAIM_GRACE_MS, 12 * 3600000);

// upi:// link: every value encoded, amount with 2 decimals, note within the limit
const upi = new URL(upiPayUrl({ upiId: 'stay.cabs@okaxis', payee: 'Staycabs & Co', amount: 900, reference: 'SR-1042' }).replace('upi://', 'http://x/'));
assert.equal(upi.pathname, '/pay');
assert.equal(upi.searchParams.get('pa'), 'stay.cabs@okaxis');
assert.equal(upi.searchParams.get('pn'), 'Staycabs & Co');
assert.equal(upi.searchParams.get('am'), '900.00');
assert.equal(upi.searchParams.get('cu'), 'INR');
assert.equal(upi.searchParams.get('tn'), 'Staycabs & Co SR-1042 advance');
assert.equal(upi.searchParams.get('tr'), 'SR-1042');
const raw = upiPayUrl({ upiId: 'a@ybl', payee: 'A B', amount: 1234.5, reference: 'SR-1' });
assert.ok(raw.includes('pn=A%20B') && !raw.includes('+'), raw); // %20, never form-encoded "+"
assert.ok(raw.includes('am=1234.50'));
const longNote = new URL(upiPayUrl({ upiId: 'a@ybl', payee: 'A Very Long Homestay And Cab Network Name Pvt Ltd', amount: 1, reference: 'REQ-9F2A61C04B' }).replace('upi://', 'http://x/')).searchParams.get('tn')!;
assert.ok(longNote.length <= UPI_NOTE_MAX && longNote.includes('REQ-9F2A61C04B'), longNote);
assert.equal(upiPayUrl({ upiId: '', payee: 'S', amount: 900, reference: 'R' }), ''); // no UPI ID: no section
assert.equal(upiPayUrl({ upiId: 'not-a-vpa', payee: 'S', amount: 900, reference: 'R' }), '');
assert.equal(upiPayUrl({ upiId: 'a@ybl', payee: 'S', amount: 0, reference: 'R' }), '');
assert.equal(upiPayUrl({ upiId: 'a@ybl', payee: 'S', amount: NaN, reference: 'R' }), '');
// ask-cab delivery status only moves forward; failed is terminal; "sent" never overwrites anything
const moves = (from: string, to: string) => askCabStatusFrom(to).includes(from);
assert.ok(moves('sent', 'delivered') && moves('sent', 'read') && moves('delivered', 'read'));
assert.ok(!moves('read', 'delivered') && !moves('delivered', 'delivered') && !moves('read', 'failed'));
assert.ok(moves('sent', 'failed') && moves('delivered', 'failed'));
for (const s of ['sent', 'delivered', 'read']) assert.ok(!moves('failed', s), `failed -> ${s}`);
assert.deepEqual(askCabStatusFrom('sent'), []);
assert.deepEqual(askCabStatusFrom('bogus'), []);
// the guest link id round-trips through Meta's callback data
assert.equal(readOpaqueData(opaqueData('ASK_CAB', { ref: '65f0c0ffee0000000000abcd', tenantId: 'h@x.in' })).ref, '65f0c0ffee0000000000abcd');

// cooldown blocks owner / automatic repeats; only an admin's force sends anyway
const t0 = Date.UTC(2026, 10, 1, 6, 0);
assert.ok(askCabBlocked(t0 - 3 * 3600000, 12, t0));
assert.ok(!askCabBlocked(t0 - 3 * 3600000, 12, t0, true));
assert.ok(!askCabBlocked(t0 - 12 * 3600000, 12, t0)); // cooldown over
assert.ok(!askCabBlocked(t0 - 60000, 0, t0)); // cooldown off
assert.ok(!askCabBlocked(null, 12, t0));
assert.equal(askCabLine({ at: t0, by: 'auto', status: 'read' }), 'Automatic · 1 Nov 11:30 AM · read');
assert.equal(askCabLine({ at: t0, by: 'admin:Ravi' }), 'Admin Ravi · 1 Nov 11:30 AM'); // link expired: no status
assert.equal(askCabLine({ at: t0, by: 'owner', status: 'delivered' }), 'Owner · 1 Nov 11:30 AM · delivered');
assert.equal(askCabConfirmText(['Owner · a', 'Automatic · b']), 'Already sent:\nOwner · a\nAutomatic · b\n\nSend again?');
assert.equal(askCabByLabel('auto'), 'automatic');
assert.equal(askCabByLabel('admin:Ravi'), 'Staycabs team');

// once per booking: auto / owner blocked after any successful send, allowed with none or only failed ones; admin force allowed
const status: Record<string, string> = { L1: 'failed', L2: 'read' };
const st = (id?: string) => (id ? status[id] : undefined);
assert.equal(askCabPrior(undefined, st), null);
assert.equal(askCabPrior([], st), null);
assert.equal(askCabPrior([{ at: 1, by: 'auto', linkId: 'L1' }], st), null); // webhook marked it failed
assert.equal(askCabPrior([{ at: 1, by: 'auto', linkId: 'L2' }], st)?.by, 'auto');
assert.equal(askCabPrior([{ at: 1, by: 'admin:Ravi', linkId: 'GONE' }], st)?.by, 'admin:Ravi'); // expired link still counts as sent
assert.equal(askCabPrior([{ at: 1, by: 'owner', linkId: 'L2' }, { at: 2, by: 'auto', linkId: 'L1' }], st)?.by, 'owner'); // latest not failed
assert.equal(askCabPrior([{ at: 1, by: 'auto', linkId: 'L2' }], st, true), null); // admin force

// history keeps the last 5 sends
let h: { at: number; by: string }[] | undefined;
for (let i = 1; i <= 7; i++) h = pushAskCab(h, { at: i, by: 'owner' });
assert.equal(ASK_CAB_KEEP, 5);
assert.deepEqual(h!.map((e) => e.at), [3, 4, 5, 6, 7]);

// the owner's guest-based button maps to the guest's current booking (by guest id or last 10 phone digits)
const bk = (id: number, o: Partial<{ guestId: number; phone: string; status: string; checkIn: number; checkOut: number; external: unknown }>) =>
  ({ id, guestId: 1, phone: '+91 98765 43210', status: 'CONFIRMED', checkIn: t0 + 5 * 86400000, checkOut: t0 + 7 * 86400000, ...o });
const stays = [
  bk(1, { checkIn: t0 + 10 * 86400000, checkOut: t0 + 12 * 86400000 }), // later stay
  bk(2, {}), // nearest upcoming
  bk(3, { status: 'CHECKED_OUT', checkIn: t0 - 3 * 86400000, checkOut: t0 - 86400000 }),
  bk(4, { status: 'CONFIRMED', checkIn: t0 - 3 * 86400000, checkOut: t0 - 86400000 }), // ended, never checked in
  bk(5, { guestId: 2, phone: '9000000000', checkIn: t0 - 86400000, checkOut: t0 + 86400000 }),
];
assert.equal(currentBookingOf(stays, 1, '', t0)?.id, 2);
assert.equal(currentBookingOf(stays, undefined, '9876543210', t0)?.id, 2); // phone match
assert.equal(currentBookingOf([...stays, bk(6, { status: 'CHECKED_IN', checkIn: t0 - 86400000 })], 1, '', t0)?.id, 6); // current stay first
assert.equal(currentBookingOf(stays, 2, '', t0)?.id, 5); // stay already started
assert.equal(currentBookingOf(stays, 9, '1111111111', t0), undefined); // no current booking: per-phone cooldown applies
// calendar imports count once the owner added the guest; without a guest (id 0, no phone) or as a date block they don't
assert.equal(currentBookingOf([bk(7, { external: { source: 'Airbnb' }, guestId: 0, phone: '' })], 1, '', t0), undefined);
assert.equal(currentBookingOf([bk(7, { external: { source: 'Airbnb' } })], undefined, '9876543210', t0)?.id, 7);
assert.equal(currentBookingOf([bk(7, { external: { source: 'Airbnb' } })], 1, '', t0)?.id, 7);
assert.equal(currentBookingOf([bk(7, { external: { source: 'Booking.com', block: true } as any })], 1, '9876543210', t0), undefined);

// guests staying: checked in / arriving by today first, then by check-in date
const today = Date.UTC(2026, 10, 1, 0, 0) - 330 * 60000; // IST midnight, 1 Nov
const order = [
  { k: 'future-early', status: 'CONFIRMED', checkIn: today + 2 * 86400000 },
  { k: 'in-house', status: 'CHECKED_IN', checkIn: today - 3 * 86400000 },
  { k: 'future-late', status: 'CONFIRMED', checkIn: today + 5 * 86400000 },
  { k: 'arriving-today', status: 'CONFIRMED', checkIn: today },
].sort(stayOrder(today + 10 * 3600000)).map((b) => b.k);
assert.deepEqual(order, ['in-house', 'arriving-today', 'future-early', 'future-late']);

// advance window: never 0 (a saved 0 is clamped to 15), default 120
assert.equal(resolvePlatformConfig({ advanceWindowMin: 0 }).advanceWindowMin, 15);
assert.equal(resolvePlatformConfig({}).advanceWindowMin, 120);
// advance deadline: the window, capped at pickup - 15 min, never sooner than 10 min from now
const cfg120 = resolvePlatformConfig({});
const ist = (ms: number) => { const d = new Date(ms + 330 * 60000); return { date: ms, time: `${String(d.getUTCHours() % 12 || 12).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} ${d.getUTCHours() < 12 ? 'AM' : 'PM'}` }; };
const near = (a: Date, b: number) => Math.abs(a.getTime() - b) < 2 * 60000;
assert.ok(near(dueAt(cfg120), Date.now() + 120 * 60000));
assert.ok(near(dueAt(cfg120, ist(Date.now() + 10 * 86400000)), Date.now() + 120 * 60000)); // pickup far away
assert.ok(near(dueAt(cfg120, ist(Date.now() + 60 * 60000)), Date.now() + 45 * 60000)); // pickup in 1h: pickup - 15
assert.ok(near(dueAt(cfg120, ist(Date.now() + 15 * 60000)), Date.now() + 10 * 60000)); // pickup in 15 min: 10 min floor

// a pending UPI claim survives a release as an unmatched payment; the update is pinned to that claim
const at0 = new Date();
const kept = keepClaim({ paymentClaim: { utr: '123456789012', amount: 900, submittedAt: at0, status: 'PENDING' } });
assert.deepEqual(kept.entry, { paymentId: '123456789012', amount: 900, status: UNVERIFIED_CLAIM, at: at0, refundedAt: null, refundReference: '' });
assert.deepEqual(kept.pin, { 'paymentClaim.status': 'PENDING', 'paymentClaim.utr': '123456789012' });
assert.equal(keepClaim({ paymentClaim: { utr: '1', status: 'REJECTED' } }).entry, null);
assert.equal(keepClaim({ paymentClaim: null }).entry, null);
assert.deepEqual(keepClaim({}).pin, { 'paymentClaim.status': { $ne: 'PENDING' } });

// app rooms: no price = null ("Price on request"), no number = null, nothing from the legacy type
const lp = { _id: 'p1', slug: 'hill', name: 'Hill', town: 'Mirik' };
const bare = tenantRoomView(lp, { id: 3, type: 'Family' });
assert.equal(bare.price, null);
assert.equal(bare.nightly, null);
assert.equal(bare.number, null);
assert.equal(bare.code, 'hill-3');
assert.equal(bare.maxGuests, 2);
assert.equal(tenantRoomView(lp, { id: 3, number: '12', price: 1800 }).price, 1800);

// admin-assigned driver without an account: his link is keyed to the assignment's phone, never to own-fleet trips
assert.equal(linkDriverId({ assignedDriverUserId: null, assignedDriverPhone: '+91 98320 12345' }), 'tel-9832012345');
assert.equal(linkDriverId({ assignedDriverUserId: null, ownFleet: true, ownDriverId: null, assignedDriverPhone: '9832012345' }), '');
assert.equal(linkDriverId({ assignedDriverUserId: null, assignedDriverPhone: '' }), '');
assert.deepEqual(linkDriverFilter('tel-9832012345'), { assignedDriverUserId: null, ownFleet: { $ne: true }, assignedDriverPhone: { $regex: '9832012345$' } });
assert.deepEqual(linkDriverFilter('tel-'), { _id: null }); // never "every trip"
assert.equal(driverTripView({ ...trip, assignedDriverUserId: null, assignedDriverPhone: '9832012345' }, 'tel-9832012345').driverView, 'ASSIGNED');

// own-driver identity is per homestay: overlap / busy / wallet lookups carry the tenant
assert.deepEqual(heldByFilter('own-7', 'a@x.com'), { propertyId: 'a@x.com', $or: [{ assignedDriverUserId: 'own-7' }, { ownFleet: true, ownDriverId: 7 }] });
assert.deepEqual(heldByFilter('u1', 'a@x.com'), { assignedDriverUserId: 'u1' });
assert.notEqual(driverKey('own-7', 'a@x.com'), driverKey('own-7', 'b@x.com'));
assert.equal(driverKey('u1', 'a@x.com'), 'u1');
assert.deepEqual(walletTrips(driverKey('own-7', 'a@x.com')), heldByFilter('own-7', 'a@x.com'));
assert.deepEqual(walletTrips('own-7'), { assignedDriverUserId: 'own-7' }); // legacy unscoped id stays as it was
assert.deepEqual(walletTrips('u1'), { assignedDriverUserId: 'u1' });
assert.ok(isOwnQuote({ driverId: 'own-3' }) && isOwnQuote({ driverId: 'u1', isOwnDriver: true }) && !isOwnQuote({ driverId: 'u1' }));

// union / syndicate drivers (vehicle type Fleet) can serve any request
assert.ok(vehicleFits({ type: 'Fleet' }, { vehicleType: 'Sedan', passengers: 2 }));
assert.ok(vehicleFits({ type: 'Fleet' }, { vehicleType: 'SUV', passengers: 7 }));
assert.ok(!vehicleFits({ type: 'Sedan' }, { vehicleType: 'SUV', passengers: 2 }));

// auto-complete 8h after pickup: started trips, and paid PIN-less ones (flagged); never one without a driver
{
  const pickup = istDateTime(Date.UTC(2026, 10, 1), '09:00 AM')!;
  const base = { date: Date.UTC(2026, 10, 1), time: '09:00 AM', advancePaid: true };
  const later = pickup + 8 * 3600000;
  assert.equal(autoCompleteKind({ ...base, status: 'TRIP_STARTED' }, later), 'started');
  assert.equal(autoCompleteKind({ ...base, status: 'CONFIRMED' }, later), 'without_pin');
  assert.equal(autoCompleteKind({ ...base, status: 'CONFIRMED' }, later - 1), null);
  assert.equal(autoCompleteKind({ ...base, status: 'CONFIRMED', needsReassignment: true }, later), null);
  assert.equal(autoCompleteKind({ ...base, status: 'CONFIRMED', advancePaid: false }, later), null);
  assert.equal(autoCompleteKind({ ...base, status: 'AWAITING_ADVANCE_PAYMENT' }, later), null);
}

// an own driver winning by quote pays exactly the own-fleet fee as advance (no wallet surplus), like assignOwnFleet
{
  const cfg: any = { ownFleetFeePercent: 5, ownFleetMinFee: 100 };
  for (const fare of [800, 2000, 4500, 12000]) {
    const s = CommissionService.split(fare, cfg.ownFleetFeePercent, 0, 0, 0, cfg.ownFleetMinFee);
    assert.equal(s.advanceAmount, ownFleetFee(cfg, fare));
    assert.equal(s.driverShareOfAdvance, 0);
    assert.equal(s.homestayCommissionAmount, 0);
  }
}

// drivers see the admin's payout minimum; a saved stale requestExpiryHours is ignored
{
  const cfg = resolvePlatformConfig({ minDriverPayoutThreshold: 250, requestExpiryHours: 3 });
  assert.equal(publicConfig(cfg).minDriverPayoutThreshold, 250);
  assert.equal(publicConfig(resolvePlatformConfig({})).minDriverPayoutThreshold, 100);
  assert.ok(!('requestExpiryHours' in cfg));
  // the quote-link page reads it through getEffectiveRates, from the same platform config
  assert.equal(CommissionService.platformConfig({ platform: { minDriverPayoutThreshold: 250 } } as any).minDriverPayoutThreshold, 250);
}

// stays without a nightly price show "Price on request", never ₹0
assert.equal(formatNightly(0), 'Price on request');
assert.equal(formatNightly(2400), '₹2,400');

// iCal import: only bookings created by this sync are returned (one bell entry each), none on a re-sync
{
  const st = new StayRideMemoryStore(false);
  st.createRoom({ number: '9', type: 'Std', floor: '1', price: 1000, status: 'AVAILABLE', note: '' } as any);
  const day = 86400000;
  const start = Date.UTC(2099, 0, 1) - 330 * 60000; // IST midnight
  const evs = [{ uid: 'a', start, end: start + 2 * day, summary: '' }, { uid: 'b', start: start + 5 * day, end: start + 6 * day, summary: '' }];
  const first = applyFeed(st, '9', 'f1', 'Airbnb', evs);
  assert.deepEqual(first.created.map((b) => [b.checkIn, b.source]), [[start, 'Airbnb'], [start + 5 * day, 'Airbnb']]);
  assert.equal(applyFeed(st, '9', 'f1', 'Airbnb', evs).created.length, 0);
  assert.equal(applyFeed(st, '9', 'f1', 'Airbnb', [{ ...evs[0], end: start + 3 * day }]).created.length, 0); // moved / cancelled: updates only
}

// transaction ids: one form everywhere (spaces / dashes dropped, upper case); UTR still 12 digits
assert.equal(normTxnId(' 4123-4567 8901 '), '412345678901');
assert.equal(normTxnId('axis-ref 9f2a'), 'AXISREF9F2A');
assert.equal(parseUtr('4123-4567-8901'), '412345678901');
// reuse: refunded money never confirms a trip; a released guest claim only on its own trip and amount
{
  const claim = { paymentId: '412345678901', amount: 900, status: UNVERIFIED_CLAIM, refundedAt: null };
  assert.equal(unmatchedReuse([], 'T1', 900), null);
  assert.equal(unmatchedReuse([{ tripId: 'T1', entry: claim }], 'T1', 900), null);
  assert.ok(unmatchedReuse([{ tripId: 'T2', entry: claim }], 'T1', 900));
  assert.ok(unmatchedReuse([{ tripId: 'T1', entry: claim }], 'T1', 1200)); // other amount: the $pull would miss
  assert.ok(unmatchedReuse([{ tripId: 'T1', entry: { ...claim, refundedAt: new Date() } }], 'T1', 900));
  assert.ok(unmatchedReuse([{ tripId: 'T1', entry: { ...claim, status: 'CANCELLED' } }], 'T1', 900)); // gateway money stays to refund
}

// claim grace: now + 12h, capped at pickup + 2h, never shortening the current due time
{
  const n = Date.UTC(2026, 10, 1, 4, 0);
  assert.equal(claimHoldUntil(n + 3600000, n, null), n + CLAIM_GRACE_MS);
  assert.equal(claimHoldUntil(n + 3600000, n, n + 30 * 3600000), n + CLAIM_GRACE_MS); // pickup far away
  assert.equal(claimHoldUntil(n + 1800000, n, n + 3600000), n + 3600000 + CLAIM_PICKUP_CAP_MS); // pickup in 1h
  assert.equal(CLAIM_PICKUP_CAP_MS, 2 * 3600000);
  assert.equal(claimHoldUntil(n + 20 * 3600000, n, n + 3600000), n + 20 * 3600000); // never earlier than already due
}

// payouts: a trip completed without the PIN waits for the admin's review; a no-show never pays out
{
  const done = { propertyId: 'a@x.com', assignedDriverUserId: 'u1', status: 'COMPLETED', advancePaid: true, hostPayoutId: null, driverPayoutId: null, driverSettlementStatus: 'PENDING', financialSnapshot: { homestayCommissionAmount: 100, driverShareOfAdvance: 50 } };
  const host = sift(eligibleFilter('a@x.com'));
  const drv = sift(eligibleDriverFilter('u1'));
  const own = sift(eligibleDriverFilter('own-7:a@x.com'));
  for (const t of [done, { ...done, completedWithoutPin: false }, { ...done, completedWithoutPin: true, noPinReviewedAt: new Date() }]) {
    assert.ok(host(t) && drv(t), JSON.stringify(t));
  }
  for (const t of [{ ...done, completedWithoutPin: true }, { ...done, completedWithoutPin: true, noPinReviewedAt: null }, { ...done, completedWithoutPin: true, noPinReviewedAt: new Date(), noShow: true }]) {
    assert.ok(!host(t) && !drv(t), JSON.stringify(t));
  }
  const ownTrip = { ...done, assignedDriverUserId: null, ownFleet: true, ownDriverId: 7 };
  assert.ok(own(ownTrip) && !own({ ...ownTrip, completedWithoutPin: true })); // own-driver wallet's $or untouched
  assert.ok(!host({ ...done, hostPayoutId: 'p1' })); // locked trips stay out as before
}

// logs: guest-link / iCal / JWT tokens in the path and t / token query values never reach them
{
  const tok = 'Abc_dEf-123456789012345678901234567890xyz';
  assert.equal(safeUrl(`/v1/public/guest-links/${tok}`), '/v1/public/guest-links/[token]');
  assert.equal(safeUrl('/v1/public/guest-links/short'), '/v1/public/guest-links/[token]');
  assert.equal(safeUrl(`/v1/public/ical/${tok}.ics`), '/v1/public/ical/[token]');
  assert.equal(safeUrl('/v1/x/eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig_nature'), '/v1/x/[token]');
  assert.equal(safeUrl('/v1/public/driver-quote?t=eyJhbGciOiJIUzI1NiJ9.abc.def&x=1'), '/v1/public/driver-quote?t=[token]&x=1');
  assert.equal(safeUrl('/v1/a?token=abc&phone=9876543210'), '/v1/a?token=[token]&phone=[token]');
  assert.equal(safeUrl('/v1/admin/cab-requests/65f0c0ffee0000000000abcd/refund'), '/v1/admin/cab-requests/65f0c0ffee0000000000abcd/refund'); // ObjectIds kept
  assert.equal(safeUrl('/v1/public/cab-requests/REQ-9F2A61C04B'), '/v1/public/cab-requests/REQ-9F2A61C04B');
}

// cab dispatch: no-GPS drivers match any place name of the homestay's address (pin codes, "india", case ignored)
{
  const { areaParts, isFleet, fallbackAllDrivers, driverLinkExpirySec, tripEndAt, biddingWindowMin } = await import('../src/stayride/platform.js');
  const stored = areaParts('Gandhi Road, Darjeeling, West Bengal 734101, India').join(', ');
  assert.equal(stored, 'gandhi road, darjeeling, west bengal');
  assert.ok(areaMatches('Darjeeling', stored));
  assert.ok(areaMatches('  DARJEELING town ', stored)); // contains a part as whole words
  assert.ok(!areaMatches('darjeeling', 'Gandhi Road'));
  assert.ok(!areaMatches('Siliguri', stored));
  assert.ok(!areaMatches('734101', stored)); // a pin code alone is no place
  assert.ok(!areaMatches('Darj', stored)); // whole words only
  assert.ok(nearbyPasses(null, 40, 'Darjeeling', stored));
  assert.ok(!nearbyPasses(55, 40, 'Darjeeling', stored)); // fresh GPS still uses the radius
  assert.ok(areaMatches('Gangtok', 'Gangtok')); // old requests: just the first part

  // nobody near: the best-rated active drivers whose vehicle fits, capped
  const c = [{ id: 'a', avgRating: 4.1 }, { id: 'b', avgRating: 4.9 }, { id: 'c', avgRating: 4.5 }];
  assert.equal(fallbackAllDrivers(2, c, 5), null);
  assert.deepEqual(fallbackAllDrivers(0, c, 2)?.map((x) => x.id), ['b', 'c']);
  assert.equal(fallbackAllDrivers(0, [], 5), null);
  assert.equal(fallbackAllDrivers(0, c, 0), null);

  // fleet / union accounts are never busy or overlapping
  assert.ok(isFleet({ vehicle: { type: 'Fleet' } }));
  assert.ok(isFleet({ driverCategory: 'UNION' }));
  assert.ok(isFleet({ vehicleType: 'Fleet', driverId: 'x' })); // a quote
  assert.ok(!isFleet({ vehicle: { type: 'SUV' }, driverCategory: 'INDIVIDUAL' }));

  // driver link: 4 days, or a day past the trip (return of a round trip) when further out
  const t0 = Date.UTC(2026, 10, 1, 4, 0);
  assert.equal(driverLinkExpirySec(t0 + 3600000, t0), 4 * 86400);
  assert.equal(driverLinkExpirySec(t0 + 20 * 86400000, t0), 21 * 86400);
  const day = Date.UTC(2026, 10, 20);
  assert.equal(tripEndAt({ date: day, time: '09:00 AM' }), istDateTime(day, '09:00 AM'));
  assert.equal(tripEndAt({ date: day, time: '09:00 AM', isRoundTrip: true, returnDate: day + 2 * 86400000, returnTime: '05:00 PM' }), istDateTime(day + 2 * 86400000, '05:00 PM'));

  // bidding never closes before nearby drivers had 10 min (own-first), except the admin's instant mode (0)
  assert.equal(biddingWindowMin(5, 600, true), OWN_FIRST_MS / 60000 + 10);
  assert.equal(biddingWindowMin(5, 600, false), 5);
  assert.equal(biddingWindowMin(240, 600, true), 240);
  assert.equal(biddingWindowMin(0, 600, true), 0);
  assert.equal(biddingWindowMin(240, 150, true), 120); // close pickup: lead - 30
}

// phone normalisation: + / 00 = international, otherwise only an Indian mobile (6-9), else not sent
assert.equal(toWhatsAppNumber('+44 7911 123456'), '447911123456');
assert.equal(toWhatsAppNumber('0091 98320 12345'), '919832012345');
assert.equal(toWhatsAppNumber('098320-12345'), '919832012345');
assert.equal(toWhatsAppNumber('447911123456'), null);
assert.equal(toWhatsAppNumber('2234567890'), null);

// guest link expiry: the admin's days, but a booking's link lasts until the day after checkout
{
  const D = 86400000, now = Date.UTC(2026, 10, 1);
  assert.equal(guestLinkExpiry(now, 7), now + 7 * D);
  assert.equal(guestLinkExpiry(now, 7, now + 2 * D), now + 7 * D); // short stay: the 7 days
  assert.equal(guestLinkExpiry(now, 7, now + 20 * D), now + 21 * D); // long stay: checkout + 1 day
  // check-in resend: only when the blocking send's link is gone/expired, and only once
  const h = [{ at: 1, by: 'auto', linkId: 'L1' }];
  assert.ok(askCabResendOk(h, h[0], () => false));
  assert.ok(!askCabResendOk(h, h[0], () => true)); // link still works
  assert.ok(!askCabResendOk([...h, { at: 2, by: 'auto', linkId: 'L2', resend: true }], h[0], () => false)); // already resent once
  assert.ok(!askCabResendOk(h, null, () => false)); // nothing blocking: a normal send
  // back-dated: no automatic ask-cab once the checkout has passed
  assert.ok(autoAskCabDue({ checkOut: now + D }, now));
  assert.ok(!autoAskCabDue({ checkOut: now - D }, now));
  assert.ok(!autoAskCabDue({ checkOut: now }, now));
}

// owner-blocked calendar events are date blocks, not stays
for (const t of ['Not available', 'CLOSED - Not available', 'Blocked', 'Unavailable', 'Airbnb (Not available)']) assert.ok(isOwnerBlock(t), t);
for (const t of ['Reserved', 'Asha Rao', '']) assert.ok(!isOwnerBlock(t), t);
assert.ok(isCompleteIcs('BEGIN:VCALENDAR\r\nEND:VCALENDAR'));
assert.ok(!isCompleteIcs('BEGIN:VCALENDAR\r\nBEGIN:VEVENT')); // cut off: never applied

{
  const st = new StayRideMemoryStore(false);
  st.createRoom({ number: '9', type: 'Std', floor: '1', price: 1000, status: 'AVAILABLE', note: '' } as any);
  const day = 86400000;
  const start = Date.UTC(2099, 0, 1) - 330 * 60000;
  const evs = [
    { uid: 'r', start, end: start + 2 * day, summary: 'Reserved' },
    { uid: 'x', start: start + 3 * day, end: start + 4 * day, summary: 'Airbnb (Not available)' },
  ];
  const first = applyFeed(st, '9', 'f1', 'Airbnb', evs);
  assert.deepEqual(first.created.map((b) => b.external!.uid), ['r']); // the block is no new stay
  assert.equal(first.added, 1);
  const blk = st.bookings.find((b) => b.external?.uid === 'x')!;
  assert.ok(blk.external!.block);
  // a block still holds its dates (room protection), a stay booked here clashes
  assert.throws(() => st.createBooking({ guestName: 'A', phone: '9876543210', checkIn: start + 3 * day, checkOut: start + 4 * day, roomNumber: '9', guests: 1, amount: 0, source: 'Direct', guestId: 0 } as any), /calendar/);
  // a block overlapping a stay made here is not a double booking (often its echo)
  const own = st.createBooking({ guestName: 'B', phone: '9876543211', checkIn: start + 10 * day, checkOut: start + 11 * day, roomNumber: '9', guests: 1, amount: 0, source: 'Direct', guestId: 0 } as any);
  const echo = applyFeed(st, '9', 'f1', 'Airbnb', [...evs, { uid: 'e', start: start + 10 * day, end: start + 11 * day, summary: 'Not available' }]);
  assert.equal(echo.conflicts, 0);
  // export: only stays made here (no imported stay or block is sent back out)
  const ics = buildIcs(st, st.rooms.find((r) => r.number === '9')!.id);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.ok(ics.includes(`stayride-${st.rooms.find((r) => r.number === '9')!.id}-${own.id}@`));
  // the owner adds the guest: kept by the next sync, which only moves dates
  const stay = st.bookings.find((b) => b.external?.uid === 'r')!;
  st.attachGuest(stay.id, { name: 'Asha', phone: '+44 7911 123456' });
  applyFeed(st, '9', 'f1', 'Airbnb', [{ ...evs[0], end: start + 3 * day }, evs[1]]);
  assert.deepEqual([stay.guestName, stay.phone, stay.checkOut, stay.external!.uid], ['Asha', '+44 7911 123456', start + 3 * day, 'r']);
  assert.equal(st.guest(stay.guestId)?.phone, '+44 7911 123456');
  assert.throws(() => st.attachGuest(stay.id, { name: 'Asha', phone: '447911123456' }), /country code/);
  // the owner's cancel sticks; a cancel there (gone from the feed) is revived when it comes back
  st.cancelBooking(stay.id);
  applyFeed(st, '9', 'f1', 'Airbnb', evs);
  assert.equal(stay.status, 'CANCELLED');
  const gone = applyFeed(st, '9', 'f1', 'Airbnb', []);
  assert.equal(gone.cancelled, 0); // only the block went (not counted) and the owner-cancelled stay stays as is
  assert.equal(blk.status, 'CANCELLED');
  applyFeed(st, '9', 'f1', 'Airbnb', evs);
  assert.equal(blk.status, 'CONFIRMED');
  // a guest's new phone reaches their current stays
  st.updateGuest(own.guestId, { phone: '+91 90000 11111' });
  assert.equal(st.booking(own.id)?.phone, '+91 90000 11111');
  // owner push: one summary per room run, nothing when nothing changed
  assert.equal(syncSummary('9', [{ ok: true, added: 0, cancelled: 0, newConflicts: 0 }]), null);
  assert.match(syncSummary('9', [{ ok: true, added: 2 }, { ok: false, added: 5 }, { ok: true, cancelled: 1, newConflicts: 1 }])!.body, /^2 new bookings.*1 cancelled.*1 possible double booking/);
}

console.log('fix checks passed');
