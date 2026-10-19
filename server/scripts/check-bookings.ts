// Run: JWT_SECRET=any-private-value npx tsx scripts/check-bookings.ts
// Room status, overlaps, check-in/out and guest statistics on a fresh (non-demo) tenant store. No DB.
import assert from 'node:assert/strict';
import { StayRideMemoryStore, istDayStart } from '../src/stayride/store.js';

const DAY = 86400000;
const today = istDayStart(Date.now());
const s = new StayRideMemoryStore(false);
const r101 = s.createRoom({ number: '101', type: 'Deluxe', floor: '1', price: 3000, status: 'AVAILABLE', note: '' } as any);
s.createRoom({ number: '102', type: 'Deluxe', floor: '1', price: 3000, status: 'AVAILABLE', note: '' } as any);
assert.throws(() => s.createRoom({ number: '101', type: 'x', floor: '1', price: 1, status: 'AVAILABLE', note: '' } as any), /already exists/);
const status = (n: string) => s.roomsView().find((r) => r.number === n)!.status;
const book = (over: Record<string, any> = {}) =>
  s.createBooking({ guestName: 'Asha', phone: '9111111111', roomNumber: '101', checkIn: today, checkOut: today + 2 * DAY, guests: 2, amount: 6000, source: 'Walk-in', paid: false, ...over } as any);

// a future booking does not make the room "reserved" today
const future: any = book({ checkIn: today + 10 * DAY, checkOut: today + 12 * DAY });
assert.equal(status('101'), 'AVAILABLE');
assert.equal(s.roomsView().find((r) => r.number === '101')!.nextArrival, today + 10 * DAY);
assert.equal(s.guests.length, 1); // new guest created with the booking
assert.equal(s.guests[0].visits, 0);

// same phone → same guest, no duplicate; a refused booking creates no guest
const now: any = book({ guestName: 'Asha R' });
assert.equal(now.guestId, future.guestId);
assert.equal(s.guests.length, 1);
assert.throws(() => book({ phone: '9222222222', guestName: 'Ravi' }), /already booked/);
assert.equal(s.guests.length, 1, 'refused booking must not leave a guest behind');
assert.equal(status('101'), 'RESERVED'); // arrival today

// maintenance blocks booking; only AVAILABLE/MAINTENANCE are manual
s.updateRoom(r101.id, { status: 'OCCUPIED' } as any);
assert.equal(s.rooms.find((r) => r.number === '101')!.status, 'AVAILABLE'); // ignored
s.updateRoom(s.rooms[1].id, { status: 'MAINTENANCE' } as any);
assert.throws(() => book({ roomNumber: '102', phone: '9333333333', guestName: 'Mina' }), /maintenance/);
assert.equal(status('102'), 'MAINTENANCE');
s.updateRoom(s.rooms[1].id, { status: 'AVAILABLE' } as any);

// check-in only from the check-in day
assert.throws(() => s.checkInBooking(future.id), /Check-in opens/);
s.checkInBooking(now.id);
assert.equal(status('101'), 'OCCUPIED');

// early checkout (after 1 night) frees the remaining night the same day
s.checkOutBooking(now.id);
assert.equal(status('101'), 'AVAILABLE');
const sameDay: any = book({ phone: '9444444444', guestName: 'Dawa', checkIn: today, checkOut: today + DAY });
assert.ok(sameDay.id, 'room is bookable again right after an early checkout');

// visits counted once, spending only for paid stays (and taken back if un-paid)
const g = s.guests.find((x) => x.id === now.guestId)!;
assert.equal(g.visits, 1);
assert.equal(g.totalSpending, 0); // unpaid
s.setBookingPaid(now.id, true);
assert.equal(g.totalSpending, 6000);
s.setBookingPaid(now.id, true); // repeated: no double count
assert.equal(g.totalSpending, 6000);
s.setBookingPaid(now.id, false);
assert.equal(g.totalSpending, 0);
s.setBookingPaid(now.id, true);

// legacy stay (checked out before the flag existed, already counted) is not counted again
const legacy: any = { id: 999, guestId: g.id, guestName: 'Asha', phone: '9111111111', checkIn: today - 5 * DAY, checkOut: today - 3 * DAY, roomNumber: '102', guests: 1, status: 'CHECKED_OUT', paid: true, amount: 1000, source: 'x' };
s.bookings.push(legacy);
s.setBookingPaid(999, true);
assert.equal(g.totalSpending, 6000);

// moving uses the same overlap rule; renaming a room keeps its bookings
const blocker: any = book({ roomNumber: '102', phone: '9666666666', guestName: 'Pem', checkIn: today + 10 * DAY, checkOut: today + 11 * DAY });
assert.throws(() => s.changeBookingRoom(future.id, '102'), /already booked/); // clashes with Pem
s.cancelBooking(blocker.id);
s.changeBookingRoom(future.id, '102'); // free once Pem cancels
s.changeBookingRoom(future.id, '101'); // and back
s.updateRoom(r101.id, { number: '101A' } as any);
assert.ok(s.bookings.filter((b) => b.roomNumber === '101A').length >= 2);
assert.equal(s.bookings.some((b) => b.roomNumber === '101'), false);

// a room with live bookings cannot be deleted; a checked-in booking cannot be deleted
assert.throws(() => s.deleteRoom(r101.id), /current or upcoming bookings/);
s.checkInBooking(sameDay.id);
assert.throws(() => s.deleteBooking(sameDay.id), /Check the guest out/);

// overstay: checked in past checkout keeps the room
const over = s.booking(sameDay.id)!;
over.checkOut = today; // pretend checkout date already passed
assert.throws(() => s.createBooking({ guestName: 'Z', phone: '9555555555', roomNumber: '101A', checkIn: today, checkOut: today + DAY, guests: 1, amount: 1, source: 'x' } as any), /already booked/);

// editing a stay
const s2 = new StayRideMemoryStore(false);
s2.createRoom({ number: '201', type: 'Std', floor: '2', price: 2000, status: 'AVAILABLE', note: '' } as any);
const mk = (o: Record<string, any>) => s2.createBooking({ guestName: 'A', phone: '9000000001', roomNumber: '201', guests: 2, amount: 4000, source: 'x', paid: false, ...o } as any) as any;
const early: any = mk({ checkIn: today + 3 * DAY, checkOut: today + 5 * DAY });
const later: any = mk({ phone: '9000000002', guestName: 'B', checkIn: today + 6 * DAY, checkOut: today + 8 * DAY });
s2.editBooking(early.id, { checkIn: today, amount: 10000, guests: 3 }); // early arrival
assert.equal(s2.booking(early.id)!.checkIn, today);
assert.equal(s2.booking(early.id)!.amount, 10000);
s2.checkInBooking(early.id); // now allowed
assert.throws(() => s2.editBooking(early.id, { checkOut: today + 7 * DAY }), /booked by B/); // extend into B's stay
s2.editBooking(early.id, { checkOut: today + 6 * DAY, checkIn: today - 9 * DAY }); // extend; check-in ignored once arrived
assert.equal(s2.booking(early.id)!.checkIn, today);
assert.equal(s2.booking(early.id)!.checkOut, today + 6 * DAY);
assert.throws(() => s2.editBooking(later.id, { checkIn: today - DAY }), /into the past/);
assert.throws(() => s2.editBooking(later.id, { checkOut: today + 6 * DAY }), /after check-in/);
s2.cancelBooking(later.id);
assert.throws(() => s2.editBooking(later.id, { amount: 1 }), /cannot be edited/);
// guest phone edit cannot duplicate another guest
const gA = s2.guests.find((g) => g.name === 'A')!;
assert.throws(() => s2.updateGuest(gA.id, { phone: '+91 90000 00002' } as any), /already has this phone/);
s2.updateGuest(gA.id, { phone: '9000000001', name: 'A Sharma' } as any); // own number is fine

// partial payments
const { parseIcs, buildIcs, applyFeed, checkIcalUrl } = await import('../src/stayride/ical.js');
const { paidOf, balanceOf } = await import('../src/stayride/store.js');
const s3 = new StayRideMemoryStore(false);
s3.createRoom({ number: '301', type: 'Std', floor: '3', price: 3000, status: 'AVAILABLE', note: '' } as any);
const pb: any = s3.createBooking({ guestName: 'P', phone: '9000000009', roomNumber: '301', checkIn: today, checkOut: today + 2 * DAY, guests: 2, amount: 6000, source: 'x', advance: 1000, advanceMethod: 'UPI' } as any);
let bk = s3.booking(pb.id)!;
assert.equal(paidOf(bk), 1000);
assert.equal(balanceOf(bk), 5000);
assert.equal(bk.paid, false);
assert.throws(() => s3.addPayment(pb.id, { amount: 6000 }), /Only ₹5,000 is due/);
s3.addPayment(pb.id, { amount: 2000, method: 'CASH' });
assert.equal(balanceOf(bk), 3000);
assert.throws(() => s3.editBooking(pb.id, { amount: 2500 }), /already received/);
s3.editBooking(pb.id, { amount: 5000 });
s3.addPayment(pb.id, { amount: 2000, method: 'CARD' });
assert.equal(bk.paid, true);
s3.removePayment(pb.id, bk.payments![2].id);
assert.equal(bk.paid, false);
s3.checkInBooking(pb.id);
s3.checkOutBooking(pb.id);
const pg = s3.guests.find((g) => g.id === bk.guestId)!;
assert.equal(pg.totalSpending, 3000); // money actually received
s3.setBookingPaid(pb.id, true); // legacy switch settles the balance
assert.equal(bk.paid, true);
assert.equal(pg.totalSpending, 5000);
const full: any = s3.createBooking({ guestName: 'Q', phone: '9000000010', roomNumber: '301', checkIn: today + 5 * DAY, checkOut: today + 6 * DAY, guests: 1, amount: 3000, source: 'x', paid: true } as any);
assert.equal(s3.booking(full.id)!.payments!.length, 1);
assert.equal(s3.booking(full.id)!.paid, true);

// iCal: parse (folded lines, all-day and timed dates), build, apply, link checks
const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:abc-1@airbnb\r\nDTSTART;VALUE=DATE:20991010\r\nDTEND;VALUE=DATE:20991013\r\nSUMMARY:Reserv\r\n ed\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:abc-2@airbnb\r\nDTSTART:20991020T060000Z\r\nDTEND:20991021T050000Z\r\nEND:VEVENT\r\nEND:VCALENDAR';
const evs = parseIcs(ics);
assert.equal(evs.length, 2);
assert.equal(evs[0].summary, 'Reserved');
assert.equal(evs[0].end - evs[0].start, 3 * DAY);
assert.equal(istDayStart(evs[0].start), evs[0].start);
const s4 = new StayRideMemoryStore(false);
const room4: any = s4.createRoom({ number: '401', type: 'Std', floor: '4', price: 1000, status: 'AVAILABLE', note: '' } as any);
const mine4: any = s4.createBooking({ guestName: 'Local', phone: '9000000011', roomNumber: '401', checkIn: evs[1].start, checkOut: evs[1].end, guests: 1, amount: 1000, source: 'x' } as any);
let r = applyFeed(s4, '401', 'feed1', 'Airbnb', evs);
assert.deepEqual([r.added, r.cancelled, r.conflicts], [2, 0, 1]); // second Airbnb stay overlaps a local booking
assert.equal(s4.guests.length, 1); // imported blocks never create guests
r = applyFeed(s4, '401', 'feed1', 'Airbnb', evs); // re-sync: nothing new
assert.deepEqual([r.added, r.updated], [0, 0]);
r = applyFeed(s4, '401', 'feed1', 'Airbnb', [{ ...evs[0], end: evs[0].end + DAY }]); // one moved, one cancelled on Airbnb
assert.deepEqual([r.updated, r.cancelled, r.conflicts], [1, 1, 0]);
assert.throws(() => s4.createBooking({ guestName: 'Z', phone: '9000000012', roomNumber: '401', checkIn: evs[0].start, checkOut: evs[0].start + DAY, guests: 1, amount: 1, source: 'x' } as any), /already booked/); // OTA block holds the room
const out = buildIcs(s4, room4.id);
assert.ok(out.includes('DTSTART;VALUE=DATE:20991010') && out.includes('SUMMARY:Not available'));
assert.ok(!out.includes('Local') && !out.includes('9000000011'), 'export never leaks guest details');
assert.ok(out.includes(`stayride-${room4.id}-${mine4.id}`));
const allowed = ['airbnb.com', 'booking.com'];
assert.equal(checkIcalUrl('https://www.airbnb.com/calendar/ical/1.ics?s=x', allowed).hostname, 'www.airbnb.com');
assert.throws(() => checkIcalUrl('http://www.airbnb.com/x.ics', allowed), /https/);
assert.throws(() => checkIcalUrl('https://evil.com/airbnb.com.ics', allowed), /not supported/);
assert.throws(() => checkIcalUrl('https://airbnb.com.evil.com/x', allowed), /not supported/);
assert.throws(() => checkIcalUrl('https://169.254.169.254/latest', allowed), /not supported/);
assert.throws(() => checkIcalUrl('https://user:pw@airbnb.com/x', allowed), /not allowed/);

console.log('booking checks passed');
