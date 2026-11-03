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
assert.equal(currentBookingOf([bk(7, { external: { source: 'Airbnb' }, phone: '' })], 1, '', t0), undefined);

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

console.log('fix checks passed');
