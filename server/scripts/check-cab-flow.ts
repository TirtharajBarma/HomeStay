// Run: JWT_SECRET=any-private-value NODE_ENV=test npx tsx scripts/check-cab-flow.ts
// Uses its OWN in-memory MongoDB (never MONGODB_URI) to check the cab-flow rules that protect revenue:
// held guest inquiries, the advance deadline, contact info in quote notes, vehicle matching.
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { markInMemoryDb } from '../src/config/env.js';

const mongod = await MongoMemoryServer.create();
markInMemoryDb();
await mongoose.connect(mongod.getUri());

const { cabModel, containsContactInfo, releaseUnpaidAdvances, dispatchRequest, driverSubmitQuote, listDriverTrips } = await import('../src/stayride/platform.js');
const Cab = cabModel(false);

let n = 0;
const base = (over: Record<string, any> = {}) => ({
  reference: `REQ-T${++n}`,
  propertyId: 'owner@x.in',
  homestayName: 'Hill View',
  guestName: 'Asha',
  guestPhone: '9111111111',
  pickupLocation: { address: 'Hill View' },
  destinations: [{ address: 'Batasia Loop', order: 0 }],
  date: Date.now() + 86400000,
  time: '09:00 AM',
  vehicleType: 'SUV',
  status: 'FINDING_DRIVER',
  ...over,
});
const quote = (id: string, status: string, fare = 3000) => ({ driverId: id, driverName: id, driverPhone: '9222222222', driverVehicle: 'Innova', quotedFare: fare, status });
const driver = (id: string, type?: string) => ({ _id: id, name: id, phone: '9222222222', vehicle: type ? { type } : {} });

// --- contact info in notes ---
assert.equal(containsContactInfo('Innova, AC, 2 bags ok'), false);
assert.equal(containsContactInfo('call me 98320 12345'), true);
assert.equal(containsContactInfo('9 8 3 2 0 1 2 3 4 5'), true);
assert.equal(containsContactInfo('wa.me/919832012345'), true);
assert.equal(containsContactInfo('me@mail.com'), true);

// --- advance deadline ---
const past = new Date(Date.now() - 60000);
const future = new Date(Date.now() + 600000);
const awaiting = (over: Record<string, any>) =>
  Cab.create(base({
    status: 'AWAITING_ADVANCE_PAYMENT', advanceDueAt: past, assignedDriverUserId: 'd1', assignedDriverName: 'd1', assignedDriverPhone: '9222222222',
    agreedFare: 3000, advanceAmount: 450, remainingCashAmount: 2550,
    financialSnapshot: { agreedFare: 3000, advanceAmount: 450, platformFeeRate: 0.05, platformFeeAmount: 150, homestayCommissionRate: 0.1, homestayCommissionAmount: 300, driverPayoutAmount: 2550, remainingCashToDriver: 2550 },
    ...over,
  }));

const overdue = await awaiting({ quotes: [quote('d1', 'ACCEPTED'), quote('d2', 'REJECTED', 3200)] });
const alone = await awaiting({ quotes: [quote('d1', 'ACCEPTED')] });
const notYet = await awaiting({ advanceDueAt: future, quotes: [quote('d1', 'ACCEPTED')] });
const paid = await awaiting({ advancePaid: true, status: 'CONFIRMED', quotes: [quote('d1', 'ACCEPTED')] });

assert.equal(await releaseUnpaidAdvances(false), 2);
const o: any = await Cab.findById(overdue._id).lean();
assert.equal(o.status, 'QUOTE_RECEIVED'); // the other driver's quote is live again
assert.equal(o.quotes.length, 1);
assert.equal(o.quotes[0].driverId, 'd2');
assert.equal(o.quotes[0].status, 'PENDING');
assert.equal(o.assignedDriverUserId, null);
assert.equal(o.agreedFare, 0);
assert.equal(o.advanceAmount, 0);
assert.equal(o.financialSnapshot, undefined);
assert.equal(o.advanceDueAt, null);
const a: any = await Cab.findById(alone._id).lean();
assert.equal(a.status, 'FINDING_DRIVER'); // nobody else quoted
assert.equal(a.quotes.length, 0);
assert.equal((await Cab.findById(notYet._id).lean() as any).status, 'AWAITING_ADVANCE_PAYMENT');
assert.equal((await Cab.findById(paid._id).lean() as any).status, 'CONFIRMED');
assert.equal(await releaseUnpaidAdvances(false), 0); // idempotent

// --- held guest inquiry ---
const held: any = await Cab.create(base({ dispatched: false, requestSource: 'GUEST_WEB_LINK' }));
await assert.rejects(driverSubmitQuote(false, held.reference, driver('d3'), 2500, ''), /no longer accepting/);
const listed = await listDriverTrips(false, driver('d3'), true);
assert.ok(!listed.some((t: any) => t.reference === held.reference), 'held request must be invisible to drivers');
await dispatchRequest('owner@x.in', false, held.reference);
assert.equal(((await Cab.findById(held._id).lean()) as any).dispatched, true);
await dispatchRequest('owner@x.in', false, held.reference); // already sent: no error
assert.ok((await listDriverTrips(false, driver('d3'), true)).some((t: any) => t.reference === held.reference));
await assert.rejects(dispatchRequest('owner@x.in', false, 'REQ-NOPE'), /not found/);
const cancelled: any = await Cab.create(base({ dispatched: false, status: 'CANCELLED' }));
await assert.rejects(dispatchRequest('owner@x.in', false, cancelled.reference), /can no longer/);

// --- notes + vehicle matching ---
await assert.rejects(driverSubmitQuote(false, held.reference, driver('d3'), 2500, 'call 9832012345'), /phone numbers/);
await driverSubmitQuote(false, held.reference, driver('d3'), 2500, 'AC car, 2 bags ok');
const sedanOnly: any = await Cab.create(base({ vehicleType: 'Sedan', dispatched: true }));
const suvDriver = await listDriverTrips(false, driver('d4', 'SUV'), true);
assert.ok(!suvDriver.some((t: any) => t.reference === sedanOnly.reference), 'SUV driver must not see Sedan requests');
const sedanDriver = await listDriverTrips(false, driver('d5', 'Sedan'), true);
assert.ok(sedanDriver.some((t: any) => t.reference === sedanOnly.reference));
const noType = await listDriverTrips(false, driver('d6'), true);
assert.ok(noType.some((t: any) => t.reference === sedanOnly.reference), 'a driver with no vehicle type sees everything');

// ---------------------------------------------------------------------------
// Admin settings, own-fleet fees, gateway payments, nearby matching, ask-cab cooldown
// ---------------------------------------------------------------------------
const { CommissionService } = await import('../src/services/commission.service.js');
const { resolvePlatformConfig, pickupTimes, ownFleetFee, DEFAULT_PLATFORM_CONFIG } = await import('../src/services/platform-config.js');
const { verifyWebhookSignature } = await import('../src/services/payment-gateway.service.js');
const { assignOwnFleet, recordGatewayPayment, matchingDrivers, sendAskCab, userModel, expireStaleRequests } = await import('../src/stayride/platform.js');
const { getGuestLinkModel } = await import('../src/models/guest-link.model.js');
const crypto = await import('node:crypto');

// settings: validation and clamping
const cfgBad = resolvePlatformConfig({ advanceWindowMin: 2, ownFleetFeePercent: 90, pickupStart: '11:00 PM', pickupEnd: '01:00 AM', vehicles: { Sedan: { enabled: false }, SUV: { enabled: false }, '7-seater': { enabled: false }, '9-seater': { enabled: false } } });
assert.equal(cfgBad.advanceWindowMin, 5); // below 5 (but not 0) is raised to 5
assert.equal(cfgBad.ownFleetFeePercent, 50); // clamped
assert.equal(cfgBad.pickupStart, DEFAULT_PLATFORM_CONFIG.pickupStart); // end before start → defaults
assert.equal(cfgBad.vehicles.SUV.enabled, true); // never zero bookable vehicle classes
assert.equal(resolvePlatformConfig({}).advanceWindowMin, 0); // payment deadline is OFF by default
const times = pickupTimes(resolvePlatformConfig({}));
assert.equal(times[0], '03:30 AM'); // Tiger Hill sunrise departures are bookable
assert.ok(times.includes('04:00 AM') && times.at(-1) === '10:00 PM');
assert.equal(ownFleetFee(resolvePlatformConfig({ ownFleetFeePercent: 5, ownFleetMinFee: 100 }), 1000), 100); // min fee wins
assert.equal(ownFleetFee(resolvePlatformConfig({ ownFleetFeePercent: 5, ownFleetMinFee: 100 }), 4000), 200);
assert.equal(ownFleetFee(resolvePlatformConfig({ ownFleetFeePercent: 5, ownFleetMinFee: 100 }), 60), 60); // never above fare

// admin saves settings (partial edit merges, cache cleared)
await CommissionService.updateSettings({ globalPlatformFeePercent: 5, globalHomestayCommissionPercent: 10, platform: { advanceWindowMin: 30, ownFleetFeePercent: 4, ownFleetMinFee: 150, nearbyRadiusKm: 30, askCabCooldownHours: 12 }, updatedBy: 'test', isDemo: false });
const live = await CommissionService.getPlatformConfig(false);
assert.equal(live.advanceWindowMin, 30);
assert.equal(live.ownFleetMinFee, 150);
assert.equal(live.vehicles.Sedan.seats, 4); // untouched values keep their defaults

// own fleet: StayRide fee is the advance; pending quotes closed; deadline from settings
const ownReq: any = await Cab.create(base({ quotes: [quote('d7', 'PENDING')] , status: 'QUOTE_RECEIVED' }));
const own: any = await assignOwnFleet('owner@x.in', false, ownReq.reference, { id: 3, name: 'Karma', phone: '9333333333', vehicle: 'Bolero' }, 3000, 'owner@x.in');
assert.equal(own.status, 'AWAITING_ADVANCE_PAYMENT');
assert.equal(own.ownFleet, true);
assert.equal(own.advanceAmount, 150); // 4% of 3000 = 120 → min 150
assert.equal(own.remainingCashAmount, 2850);
assert.equal(own.financialSnapshot.platformFeeAmount, 150);
assert.equal(own.financialSnapshot.homestayCommissionAmount, 0);
assert.equal(own.quotes[0].status, 'REJECTED');
assert.ok(own.advanceDueAt && new Date(own.advanceDueAt).getTime() > Date.now() + 25 * 60000);
await assert.rejects(assignOwnFleet('owner@x.in', false, ownReq.reference, { id: 3, name: 'Karma', phone: '9333333333' }, 3000, 'x'), /no longer open/);
// own-fleet release goes back to the owner as a held request
await Cab.updateOne({ _id: ownReq._id }, { $set: { advanceDueAt: new Date(Date.now() - 1000) } });
await releaseUnpaidAdvances(false);
const ownBack: any = await Cab.findById(ownReq._id).lean();
assert.equal(ownBack.dispatched, false);
assert.equal(ownBack.ownFleet, false);
assert.equal(ownBack.status, 'QUOTE_RECEIVED'); // d7's quote is live again

// zero fee: confirmed at once
await CommissionService.updateSettings({ globalPlatformFeePercent: 5, globalHomestayCommissionPercent: 10, platform: { ownFleetFeePercent: 0, ownFleetMinFee: 0 }, updatedBy: 'test', isDemo: false });
const freeReq: any = await Cab.create(base());
const free: any = await assignOwnFleet('owner@x.in', false, freeReq.reference, { id: 4, name: 'Dawa', phone: '9444444444' }, 2000, 'x');
assert.equal(free.status, 'CONFIRMED');
assert.equal(free.advancePaid, true);
await CommissionService.updateSettings({ globalPlatformFeePercent: 5, globalHomestayCommissionPercent: 10, platform: { ownFleetFeePercent: 4, ownFleetMinFee: 150 }, updatedBy: 'test', isDemo: false });

// gateway: signature, record, duplicate, unmatched
const secret = 'whsec_test';
const body = Buffer.from(JSON.stringify({ event: 'payment_link.paid' }));
const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
assert.equal(verifyWebhookSignature(body, sig, secret), true);
assert.equal(verifyWebhookSignature(body, sig.replace(/^./, sig[0] === 'a' ? 'b' : 'a'), secret), false);
assert.equal(verifyWebhookSignature(body, sig, ''), false); // no secret configured → reject
assert.equal(verifyWebhookSignature(body, 'nothex', secret), false);
const payReq: any = await awaiting({ advanceDueAt: future, paymentLinkId: 'plink_1', quotes: [quote('d1', 'ACCEPTED')] });
assert.equal(await recordGatewayPayment('plink_1', 'pay_1', 449), 'UNMATCHED'); // wrong amount never confirms
assert.equal(await recordGatewayPayment('plink_1', 'pay_2', 450), 'RECORDED');
const paidNow: any = await Cab.findById(payReq._id).lean();
assert.equal(paidNow.status, 'CONFIRMED');
assert.equal(paidNow.advancePaymentMethod, 'GATEWAY');
assert.equal(await recordGatewayPayment('plink_1', 'pay_2', 450), 'DUPLICATE'); // webhook retry
assert.equal(await recordGatewayPayment('plink_1', 'pay_3', 450), 'UNMATCHED'); // second payment → refund
assert.equal(await recordGatewayPayment('plink_1', 'pay_3', 450), 'DUPLICATE');
assert.equal(((await Cab.findById(payReq._id).lean()) as any).unmatchedPayments.length, 2);
assert.equal(await recordGatewayPayment('plink_nope', 'pay_9', 450), 'UNKNOWN');

// nearby: radius from the homestay, nearest first, unknown-location drivers last
const Users = userModel(false);
await Users.collection.insertMany([
  { role: 'driver', accountStatus: 'ACTIVE', isAvailable: true, name: 'near', email: 'near@d.in', phone: '9000000001', vehicle: { type: 'SUV' }, location: { lat: 27.05, lng: 88.27 } },
  { role: 'driver', accountStatus: 'ACTIVE', isAvailable: true, name: 'nearer', email: 'nearer@d.in', phone: '9000000002', vehicle: { type: 'SUV' }, location: { lat: 27.041, lng: 88.266 } },
  { role: 'driver', accountStatus: 'ACTIVE', isAvailable: true, name: 'far', email: 'far@d.in', phone: '9000000003', vehicle: { type: 'SUV' }, location: { lat: 26.70, lng: 88.43 } }, // Siliguri ~45km
  { role: 'driver', accountStatus: 'ACTIVE', isAvailable: true, name: 'unknown', email: 'unknown@d.in', phone: '9000000004', vehicle: { type: 'SUV' } },
  { role: 'driver', accountStatus: 'ACTIVE', isAvailable: true, name: 'sedan', email: 'sedan@d.in', phone: '9000000005', vehicle: { type: 'Sedan' }, location: { lat: 27.041, lng: 88.266 } },
  { role: 'driver', accountStatus: 'ACTIVE', isAvailable: false, name: 'offline', email: 'offline@d.in', phone: '9000000006', vehicle: { type: 'SUV' }, location: { lat: 27.041, lng: 88.266 } },
]);
const names = (await matchingDrivers(false, { vehicleType: 'SUV', homestayLocation: { lat: 27.0410, lng: 88.2663 } }, live)).map((d: any) => d.phone);
assert.deepEqual(names, ['9000000002', '9000000001', '9000000004']); // nearest first, far/sedan/offline excluded

// ask-cab cooldown (a link sent 1h ago blocks a new one; the cooldown is 12h)
await getGuestLinkModel(false).create({ tokenHash: 'x'.repeat(64), tenantKey: 'owner@x.in', guestName: 'Asha', guestPhone: '+91 91111 11111', sentAt: new Date(Date.now() - 3600000), expiresAt: new Date(Date.now() + 86400000) });
await assert.rejects(sendAskCab('owner@x.in', false, 'Hill View', { guestName: 'Asha', guestPhone: '9111111111' }), /already asked recently/);
const other = await sendAskCab('owner@x.in', false, 'Hill View', { guestName: 'Ravi', guestPhone: '9555555555' });
assert.equal(other.result, 'SKIPPED'); // WhatsApp off in tests: nothing sent, and no cooldown recorded

// expiry hours come from settings
await CommissionService.updateSettings({ globalPlatformFeePercent: 5, globalHomestayCommissionPercent: 10, platform: { requestExpiryHours: 1 }, updatedBy: 'test', isDemo: false });
const stale: any = await Cab.create(base({ date: Date.now() - 3 * 3600000, time: '12:00 AM' }));
await expireStaleRequests(false, { reference: stale.reference });
assert.equal(((await Cab.findById(stale._id).lean()) as any).status, 'EXPIRED');

// ---------------------------------------------------------------------------
// Quote links, quote expiry, counter-offers, owner completing a forgotten trip
// ---------------------------------------------------------------------------
const P = await import('../src/stayride/platform.js');
const { default: mongooseLib } = await import('mongoose');
const drvId = new mongooseLib.Types.ObjectId();
await Users.collection.insertOne({ _id: drvId, role: 'driver', accountStatus: 'ACTIVE', isAvailable: true, name: 'Neg', email: 'neg@d.in', phone: '9000000099', vehicle: { type: 'SUV', model: 'Bolero', plate: 'WB-1' } });
const negDriver = await Users.findById(drvId).lean();

// signed links: bound to driver + request, tamper-proof
const link = P.driverQuoteLink(false, drvId, 'REQ-LINK1');
const tok = decodeURIComponent(link.split('t=')[1]);
assert.deepEqual(P.readDriverQuoteToken(tok), { driverId: String(drvId), reference: 'REQ-LINK1', isDemo: false });
assert.equal(P.readDriverQuoteToken(tok.slice(0, -2) + (tok.endsWith('A') ? 'BB' : 'AA')), null);
assert.equal(P.readDriverQuoteToken('garbage'), null);

// quote → expires after the validity → re-quote works
await CommissionService.updateSettings({ globalPlatformFeePercent: 5, globalHomestayCommissionPercent: 10, platform: { quoteValidityHours: 1, quoteBiddingWindowMin: 30 }, updatedBy: 'test', isDemo: false });
const negReq: any = await Cab.create(base({ dispatched: true }));
await P.driverSubmitQuote(false, negReq.reference, negDriver, 3000, 'AC');
await Cab.updateOne({ _id: negReq._id }, { $set: { 'quotes.0.createdAt': new Date(Date.now() - 2 * 3600000) } });
await P.expireStaleRequests(false, { reference: negReq.reference });
let nd: any = await Cab.findById(negReq._id).lean();
assert.equal(nd.quotes[0].status, 'EXPIRED');
assert.equal(nd.status, 'FINDING_DRIVER');
await P.driverSubmitQuote(false, negReq.reference, negDriver, 2900, '');
nd = await Cab.findById(negReq._id).lean();
assert.equal(nd.quotes[0].status, 'PENDING');
assert.equal(nd.quotes[0].quotedFare, 2900);
assert.equal(nd.status, 'QUOTE_RECEIVED');

// counter-offer → driver accepts → confirmed at the counter fare
await P.ownerCounterOffer('owner@x.in', false, negReq.reference, String(drvId), 2500, 'owner@x.in');
nd = await Cab.findById(negReq._id).lean();
assert.equal(nd.quotes[0].counterFare, 2500);
await assert.rejects(P.ownerCounterOffer('other@x.in', false, negReq.reference, String(drvId), 2400, 'x'), /no longer open/); // other homestay
const acc: any = await P.driverAcceptCounter(false, negReq.reference, negDriver);
assert.equal(acc.status, 'AWAITING_ADVANCE_PAYMENT');
assert.equal(acc.agreedFare, 2500);
assert.equal(acc.quotes[0].status, 'ACCEPTED');
await assert.rejects(P.driverAcceptCounter(false, negReq.reference, negDriver), /no longer open/);
// a new fare from the driver clears an open counter
const neg2: any = await Cab.create(base({ dispatched: true }));
await P.driverSubmitQuote(false, neg2.reference, negDriver, 3100, '');
await P.ownerCounterOffer('owner@x.in', false, neg2.reference, String(drvId), 2800, 'o');
await P.driverSubmitQuote(false, neg2.reference, negDriver, 3000, '');
assert.equal(((await Cab.findById(neg2._id).lean()) as any).quotes[0].counterFare, null);

// owner completes a forgotten trip only after pickup + 3h (or once started)
const paidTrip: any = await Cab.create(base({ status: 'CONFIRMED', advancePaid: true, assignedDriverUserId: String(drvId), date: Date.now(), time: '11:59 PM',
  financialSnapshot: { agreedFare: 3000, advanceAmount: 450, platformFeeRate: 0.05, platformFeeAmount: 150, homestayCommissionRate: 0.1, homestayCommissionAmount: 300, driverPayoutAmount: 2550, remainingCashToDriver: 2550 } }));
await assert.rejects(P.ownerCompleteTrip('owner@x.in', false, paidTrip.reference, 'o'), /3 hours after/);
await Cab.updateOne({ _id: paidTrip._id }, { $set: { date: Date.now() - 2 * 86400000, time: '09:00 AM' } });
const doneTrip: any = await P.ownerCompleteTrip('owner@x.in', false, paidTrip.reference, 'o');
assert.equal(doneTrip.status, 'COMPLETED');

// saving only operations config keeps the saved rates (the two admin forms never revert each other)
await CommissionService.updateSettings({ globalPlatformFeePercent: 7, globalHomestayCommissionPercent: 11, updatedBy: 'test', isDemo: false });
await CommissionService.updateSettings({ platform: { maxFare: 150000 }, updatedBy: 'test', isDemo: false });
const kept: any = await CommissionService.getSettings(false);
assert.equal(kept.globalPlatformFeePercent, 7);
assert.equal(kept.globalHomestayCommissionPercent, 11);
assert.equal(CommissionService.platformConfig(kept).maxFare, 150000);

console.log('cab flow checks passed');
await mongoose.disconnect();
await mongod.stop();
