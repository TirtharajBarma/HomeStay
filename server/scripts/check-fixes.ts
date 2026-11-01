// Run: npx tsx scripts/check-fixes.ts
// Pure-logic checks for the trip fixes (no database, nothing is sent).
import assert from 'node:assert/strict';
import { maskPhone, pickupsOverlap, OVERLAP_MS, linkDriverId, linkDriverFilter, driverTripView, istDateTime, areaMatches, nearbyPasses, nearbyNotifyTime, OWN_FIRST_MS, vehicleFits, parseUtr, CLAIM_GRACE_MS } from '../src/stayride/platform.js';
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
console.log('fix checks passed');
