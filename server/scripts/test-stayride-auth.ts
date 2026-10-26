// Security regression check for /v1 auth. Uses in-memory Mongo only (never Atlas).
// Run: npx tsx scripts/test-stayride-auth.ts
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const WEBHOOK_SECRET = 'whsec_' + crypto.randomBytes(24).toString('base64');
process.env.CLERK_WEBHOOK_SIGNING_SECRET = WEBHOOK_SECRET;
process.env.MONGODB_URI = '';
process.env.MONGODB_DATABASE = 'stayride_selftest'; // in-memory server; never "production"
process.env.PUSH_DISABLED = 'true'; // no network: push sending is a no-op

const mongo = await MongoMemoryServer.create();
await mongoose.connect(mongo.getUri(), { dbName: 'stayride_selftest' });
delete process.env.ALLOW_LOCAL_PRODUCTION_DB; // the local-production guard must not be needed here
delete process.env.CORS_ORIGIN;
const { default: app } = await import('../src/app.js');
const server = http.createServer(app);
await new Promise<void>((r) => server.listen(0, r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;

async function call(path: string, opts: { method?: string; body?: any; token?: string; raw?: string; headers?: Record<string, string> } = {}) {
  const res = await fetch(base + path, {
    method: opts.method || (opts.body || opts.raw ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...opts.headers,
    },
    body: opts.raw ?? (opts.body ? JSON.stringify(opts.body) : undefined),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) as any };
}

try {
  // clerk-sync: no Clerk session → no token issued for an arbitrary email
  let r = await call('/v1/auth/clerk-sync', { body: { email: 'victim@example.com' } });
  assert.equal(r.status, 401, 'clerk-sync must reject requests without a verified Clerk token');
  r = await call('/v1/auth/clerk-sync', { body: { email: 'victim@example.com' }, token: 'forged' });
  assert.equal(r.status, 401);

  // webhook: unsigned rejected, correctly signed accepted (proves raw-body verification works)
  const payload = JSON.stringify({ type: 'user.deleted', data: { id: 'user_x' }, object: 'event' });
  r = await call('/v1/auth/clerk-webhook', { raw: payload });
  assert.equal(r.status, 400, 'unsigned webhook must be rejected');
  const id = 'msg_1', ts = Math.floor(Date.now() / 1000).toString();
  const sig = crypto.createHmac('sha256', Buffer.from(WEBHOOK_SECRET.slice(6), 'base64')).update(`${id}.${ts}.${payload}`).digest('base64');
  r = await call('/v1/auth/clerk-webhook', { raw: payload, headers: { 'svix-id': id, 'svix-timestamp': ts, 'svix-signature': `v1,${sig}` } });
  assert.equal(r.status, 200, 'signed webhook must be accepted');

  // legacy signup + password change hashes exactly once
  const email = 'mydemo.host@example.com'; // contains "demo": must NOT get the shared demo store
  r = await call('/v1/auth/signup', { body: { email, password: 'oldpass123', name: 'Host', phone: '+91 90000 00000' } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const { accessToken, refreshToken } = r.json;

  r = await call('/v1/rooms', { token: accessToken });
  assert.deepEqual(r.json, [], '"demo"-substring emails must get their own empty tenant');
  r = await call('/v1/drivers?scope=network', { token: accessToken });
  assert.deepEqual(r.json, [], 'real tenants get no fake network drivers');

  r = await call('/v1/auth/set-password', { token: accessToken, body: { currentPassword: 'wrong', newPassword: 'newpass123' } });
  assert.equal(r.status, 401, 'wrong current password must be rejected');
  r = await call('/v1/auth/set-password', { token: accessToken, body: { currentPassword: 'oldpass123', newPassword: 'newpass123' } });
  assert.equal(r.status, 200);
  r = await call('/v1/auth/login', { body: { email, password: 'newpass123' } });
  assert.equal(r.status, 200, 'new password must work (no double hash)');

  // token types and audience
  assert.equal((await call('/v1/rooms', { token: refreshToken })).status, 401, 'refresh token is not an access token');
  assert.equal((await call('/v1/auth/refresh', { body: { refreshToken: accessToken } })).status, 401, 'access token is not a refresh token');
  assert.equal((await call('/v1/auth/refresh', { body: { refreshToken } })).status, 200);
  assert.equal((await call('/api/v1/auth/me', { token: accessToken })).status, 401, 'StayRide tokens are rejected by /api/v1');

  // Express 5 empty body no longer crashes
  r = await call('/v1/trips', { method: 'POST', token: accessToken });
  assert.notEqual(r.status, 500, 'POST without body must not 500');

  // ---- Admin, money, drivers, concurrency ----
  const { config } = await import('../src/config/env.js');
  const jwt = (await import('jsonwebtoken')).default;
  // Admin routes re-check the admin in the DB on every request, so the admin must exist.
  const { userModel: adminUsers } = await import('../src/stayride/platform.js');
  const adminDoc: any = await adminUsers(false).create({ name: 'Admin', email: 'admin@example.com', password: 'adminpass123', role: 'admin', accountStatus: 'ACTIVE' });
  const adminToken = jwt.sign({ id: String(adminDoc._id), email: 'admin@example.com', name: 'Admin', role: 'admin', tv: 0 }, config.jwtSecret);
  const ownerAsAdmin = jwt.sign({ id: 'o1', email, name: 'Host', role: 'owner' }, config.jwtSecret);
  const admin = (path: string, body?: any, method?: string) => call('/api/v1/admin' + path, { token: adminToken, body, method });

  assert.equal((await call('/api/v1/stayride/admin/payouts', { token: accessToken })).status, 404, 'no StayRide-side admin routes');
  assert.equal((await call('/api/v1/admin/host-payouts', { token: accessToken })).status, 401);
  assert.equal((await call('/api/v1/admin/host-payouts', { token: ownerAsAdmin })).status, 403);
  assert.equal((await admin('/host-payouts')).status, 200);

  const tok = (await call('/v1/auth/login', { body: { email, password: 'newpass123' } })).json.accessToken;
  const owner = (path: string, body?: any, method?: string) => call('/v1' + path, { token: tok, body, method });
  const tomorrow = Date.now() + 86400000;

  // Demo emails can't be registered; demo flag can't be forged.
  assert.equal((await call('/v1/auth/signup', { body: { email: 'stay@mountainview.in', password: 'whatever123' } })).status, 400);
  const forged = jwt.sign({ id: 'x', email, role: 'owner', tenantKey: email, isDemo: true, type: 'access' }, config.jwtSecret, { audience: 'stayride' });
  assert.equal((await call('/v1/snapshot', { token: forged })).status, 401, 'isDemo claim must match tenant');

  // 1) Concurrency: 20 parallel writes to one homestay must all persist (no lost updates).
  await Promise.all(Array.from({ length: 20 }, (_, i) => owner('/rooms', { number: `R${i}`, type: 'Std', floor: '1', price: 1000, status: 'AVAILABLE', note: '' })));
  r = await owner('/rooms');
  assert.equal(r.json.length, 20, `parallel writes lost: ${r.json.length}/20 rooms saved`);

  // Legacy public API is off by default (it leaked driver PINs and guest PII)
  for (const p of ['/api/v1/drivers', '/api/v1/properties', '/api/v1/bookings/BK-000001']) {
    assert.equal((await call(p)).status, 404, `${p} must not be mounted`);
  }
  assert.equal((await call('/api/v1/auth/otp/verify', { body: { phone: '9000000000', otp: '123456' } })).status, 404, 'legacy OTP login is off');

  // 1b) Booking state machine: no double checkout, no double-booking by moving rooms.
  const day = 86400000;
  const today = Date.now();
  const b1 = (await owner('/bookings', { guestName: 'G1', phone: '9000000011', roomNumber: 'R0', checkIn: today, checkOut: today + 2 * day, guests: 1, amount: 2000 })).json;
  const b2 = (await owner('/bookings', { guestName: 'G2', phone: '9000000012', roomNumber: 'R1', checkIn: tomorrow, checkOut: tomorrow + 2 * day, guests: 1, amount: 2000 })).json;
  assert.equal((await owner(`/bookings/${b2.id}/room`, { roomNumber: 'R0' })).status, 409, 'moving into a booked room is rejected');
  assert.equal((await owner(`/bookings/${b1.id}/check-out`, {})).status, 409, 'cannot check out before check-in');
  assert.equal((await owner(`/bookings/${b1.id}/check-in`, {})).status, 200);
  assert.equal((await owner(`/bookings/${b1.id}/check-out`, {})).status, 200);
  assert.equal((await owner(`/bookings/${b1.id}/check-out`, {})).status, 409, 'retried checkout cannot double-count');

  // 2) Mass assignment / own-driver trips carry no money.
  r = await owner('/drivers', { name: 'Own Driver', phone: '9000000002', vehicle: 'Car', vehicleType: 'SUV', seats: 4, area: 'x', trips: [] });
  const ownDriverId = r.json.id;
  r = await owner('/trips', { guestName: 'X', phone: '9000000001', date: tomorrow, time: '10:00 AM', vehicleType: 'SUV', advancePaid: true, commission: 99999, financialSnapshot: { homestayCommissionAmount: 99999 }, reference: 'REQ-HACK' });
  assert.equal(r.status, 201);
  assert.equal(r.json.advancePaid, false, 'advancePaid must ignore the forged true value');
  assert.notEqual(r.json.reference, 'REQ-HACK', 'reference must be generated by the server');
  const ownTrip = r.json.id;
  assert.equal((await owner(`/trips/${ownTrip}/assign`, { driverId: ownDriverId })).status, 200);
  r = await owner(`/trips/${ownTrip}/complete`, { finalFare: 1000000 });
  assert.equal(r.json.commission, 0, 'own-driver trips earn no platform commission');
  assert.equal((await owner(`/trips/${ownTrip}/commission/pay`, { paid: true })).status, 410);
  r = await owner('/payouts/summary');
  assert.equal(r.json.available, 0, 'nothing payable from own-driver trips');
  assert.equal((await owner('/payouts/request', { upiId: 'evil@upi' })).status, 400);

  // 3) Admin feature + block controls are enforced by the server.
  assert.equal((await owner('/campaigns')).status, 403, 'campaigns off by default');
  r = await admin(`/stayride/tenants/${encodeURIComponent(email)}/controls`, { features: { campaigns: true } }, 'PUT');
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal((await owner('/campaigns')).status, 200, 'admin granted campaigns');
  r = await admin('/commission/settings', { globalPlatformFeePercent: 5, globalHomestayCommissionPercent: 10, features: { campaigns: { enabled: false } } }, 'PUT');
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal((await owner('/campaigns')).status, 403, 'global disable wins over homestay override');
  await admin('/commission/settings', { globalPlatformFeePercent: 5, globalHomestayCommissionPercent: 10, features: { campaigns: { enabled: true } } }, 'PUT');
  assert.equal((await admin('/commission/settings', { globalPlatformFeePercent: 60, globalHomestayCommissionPercent: 50 }, 'PUT')).status, 400, 'PF+HC >= 100 rejected');
  assert.equal((await admin('/commission/settings', { globalPlatformFeePercent: 'abc', globalHomestayCommissionPercent: 10 }, 'PUT')).status, 400, 'NaN rejected');

  // 4) Guest link → platform request (secure token, no PII in link).
  r = await owner('/guest-links', { guestName: 'Asha', guestPhone: '+91 90000 11111' });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const t = new URL(r.json.url).searchParams.get('t')!;
  assert.ok(t.length >= 40 && !r.json.url.includes('@') && !r.json.url.includes('90000'));
  const reqBody = { guestName: 'Asha', guestPhone: '+91 90000 11111', destinations: ['Tiger Hill', 'Batasia Loop'], isRoundTrip: false, date: tomorrow, time: '09:00 AM', passengers: 2, vehicleType: 'SUV', clientRequestId: 'c-1' };
  assert.equal((await call(`/v1/public/guest-links/${t}/cab-requests`, { body: { ...reqBody, date: Date.now() - 3 * 86400000 } })).status, 400, 'past date rejected');
  r = await call(`/v1/public/guest-links/${t}/cab-requests`, { body: reqBody });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const reference = r.json.reference;
  assert.equal((await call(`/v1/public/guest-links/${t}/cab-requests`, { body: reqBody })).json.reference, reference, 'idempotent');

  // Blocking the homestay kills its guest links and owner API.
  await admin(`/stayride/tenants/${encodeURIComponent(email)}/controls`, { blocked: true, blockReason: 'KYC pending' }, 'PUT');
  r = await owner('/snapshot');
  assert.equal(r.status, 403);
  assert.equal(r.json.error.code, 'ACCOUNT_BLOCKED');
  assert.equal((await call(`/v1/public/guest-links/${t}`)).status, 404, 'blocked homestay link disabled');
  assert.equal((await call('/v1/auth/login', { body: { email, password: 'newpass123' } })).status, 403, 'blocked owner cannot log in');
  await admin(`/stayride/tenants/${encodeURIComponent(email)}/controls`, { blocked: false }, 'PUT');
  assert.equal((await owner('/snapshot')).status, 200);

  // 5) Drivers: self-signup is pending until admin approval; no guest PII before assignment.
  const d1Body = { email: 'd1@example.com', password: 'driverpass1', name: 'Driver One', phone: '9800011111', role: 'driver', vehicleType: 'SUV', vehicleNumber: 'SK01A1234' };
  assert.equal((await call('/v1/auth/signup', { body: d1Body })).status, 400, 'D4: driver area is required');
  r = await call('/v1/auth/signup', { body: { ...d1Body, area: 'Darjeeling' } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.driver.area, 'Darjeeling');
  assert.equal(r.json.driver.status, 'PENDING_APPROVAL');
  const dTok = r.json.accessToken;
  const driverId = r.json.driver.id;
  const driver = (path: string, body?: any) => call('/v1' + path, { token: dTok, body });
  assert.equal((await driver('/driver/trips')).status, 403, 'pending driver blocked');

  // P1: push tokens (pending drivers too): validated, deduped, capped at 10, removable.
  const { userModel: users } = await import('../src/stayride/platform.js');
  const tokensOf = async (id: string) => ((await users(false).findById(id).select('+pushTokens').lean()) as any).pushTokens.map((t: any) => t.token);
  assert.equal((await call('/v1/push-token', { token: dTok, body: { token: 'nope', platform: 'android' } })).status, 400);
  assert.equal((await call('/v1/push-token', { token: dTok, body: { token: 'ExponentPushToken[a1]', platform: 'web' } })).status, 400);
  for (let i = 0; i < 12; i++) {
    r = await call('/v1/push-token', { token: dTok, body: { token: `ExponentPushToken[t${i}]`, platform: 'android' } });
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
  }
  await call('/v1/push-token', { token: dTok, body: { token: 'ExponentPushToken[t5]', platform: 'ios' } });
  let toks = await tokensOf(driverId);
  assert.equal(toks.length, 10, 'push tokens capped at 10');
  assert.equal(toks.filter((x: string) => x === 'ExponentPushToken[t5]').length, 1, 'push tokens deduped');
  assert.equal(toks[9], 'ExponentPushToken[t5]', 're-registered token moves to newest');
  r = await call('/v1/push-token', { token: dTok, method: 'DELETE', body: { token: 'ExponentPushToken[t5]' } });
  assert.equal(r.status, 200);
  toks = await tokensOf(driverId);
  assert.ok(!toks.includes('ExponentPushToken[t5]') && toks.length === 9, 'logout removes the token');
  assert.equal((await owner('/push-token', { token: 'ExpoPushToken[owner1]', platform: 'ios' })).status, 200, 'owners can register');
  r = await call('/v1/auth/login', { body: { email: 'd1@example.com', password: 'driverpass1' } });
  assert.equal(r.json.driver.pushTokens, undefined, 'tokens never leak in profiles');
  assert.equal((await driver('/rooms')).status, 403, 'drivers cannot use owner API');
  assert.equal((await admin(`/stayride/drivers/${driverId}/status`, { status: 'ACTIVE' }, 'PATCH')).status, 200);
  r = await driver('/driver/trips');
  assert.equal(r.status, 200);
  const open = r.json.find((x: any) => x.reference === reference);
  assert.ok(open, 'approved driver sees open request');
  assert.equal(open.phone, undefined, 'no guest phone before assignment');
  assert.equal(open.guestName, undefined, 'no guest name before assignment');

  assert.equal(open.driverView, 'OPEN');
  assert.equal(open.driverNetPayout, null, 'no net payout before a fare is agreed');
  r = await driver(`/driver/trips/${reference}/quote`, { quotedFare: 2600, notes: 'first' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.driverView, 'QUOTED');
  // D2: quote revision replaces my own quote.
  r = await driver(`/driver/trips/${reference}/quote`, { quotedFare: 2500, notes: 'revised' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json.myQuote, { quotedFare: 2500, status: 'PENDING', notes: 'revised' });
  let ownerTrip = (await owner('/trips')).json.find((x: any) => x.reference === reference);
  assert.equal(ownerTrip.quotes.length, 1, 'owner sees the real driver quote (revised, not duplicated)');
  assert.equal(ownerTrip.quotes[0].quotedFare, 2500);
  assert.equal(ownerTrip.quotes[0].driverRating, null, 'unrated driver: rating null, never 0');
  assert.equal(ownerTrip.quotes[0].driverRatingCount, 0);
  assert.equal(ownerTrip.driverRated, false);
  assert.equal((await owner(`/trips/${ownerTrip.id}/complete`, {})).status, 409, 'owner cannot complete platform trips');
  assert.equal((await owner(`/trips/${ownerTrip.id}/quote`, { driverId: 1, quotedFare: 10 })).status, 409, 'owner cannot fake platform quotes');

  // Owner confirms the quote: fare comes from the quote, not the client.
  r = await owner(`/trips/${ownerTrip.id}/confirm-quote`, { driverId, agreedFare: 999999 });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.fare, 2500);
  assert.equal(r.json.status, 'AWAITING_ADVANCE');
  const snap = r.json.financialSnapshot;
  assert.deepEqual([snap.platformFeeAmount, snap.homestayCommissionAmount, snap.driverPayoutAmount], [125, 250, 2125]);
  assert.ok(snap.advanceAmount >= 375 && snap.advanceAmount <= 2500);

  // D1: assigned driver sees fees and net payout, but no guest contact / cash due before payment.
  r = await driver('/driver/trips');
  let dv = r.json.find((x: any) => x.reference === reference);
  assert.equal(dv.driverView, 'ASSIGNED');
  assert.deepEqual([dv.platformFeeAmount, dv.homestayCommissionAmount, dv.driverNetPayout], [125, 250, 2125]);
  assert.equal(dv.phone, undefined);
  assert.equal(dv.remainingCashAmount, undefined);
  assert.equal(dv.driverSettlementStatus, 'NONE');

  // Driver can't start before payment.
  assert.equal((await driver(`/driver/trips/${reference}/start`, {})).status, 409);

  const queued = (await admin('/cab-requests/pending')).json.items.find((x: any) => x.reference === reference);
  r = await admin(`/cab-requests/${queued._id}/record-payment`, { transactionId: 'UTR1', amount: 1, method: 'UPI' });
  assert.equal(r.status, 400, 'underpayment rejected');
  r = await admin(`/cab-requests/${queued._id}/record-payment`, { transactionId: 'UTR1', amount: snap.advanceAmount, method: 'UPI' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal((await admin(`/cab-requests/${queued._id}/record-payment`, { transactionId: 'UTR1', amount: snap.advanceAmount, method: 'UPI' })).status, 409, 'once only');
  // Void + re-record works and is audited.
  assert.equal((await admin(`/cab-requests/${queued._id}/void-payment`, {})).status, 400, 'void needs a reason');
  assert.equal((await admin(`/cab-requests/${queued._id}/void-payment`, { reason: 'wrong UTR' })).status, 200);
  assert.equal((await admin(`/cab-requests/${queued._id}/record-payment`, { transactionId: 'UTR1B', amount: snap.advanceAmount, method: 'UPI' })).status, 200);

  // Driver now sees guest details, starts and completes.
  r = await driver('/driver/trips');
  const mine = r.json.find((x: any) => x.reference === reference && x.assignedToMe);
  assert.equal(mine.phone, '+91 90000 11111', 'assigned driver gets guest phone');
  assert.equal((await driver(`/driver/trips/${reference}/complete`, {})).status, 409, 'cannot complete before start');
  assert.equal((await driver(`/driver/trips/${reference}/start`, {})).status, 200);
  assert.equal((await driver(`/driver/trips/${reference}/complete`, {})).status, 200);
  // D1: driver settlement visible after admin records it.
  dv = (await driver('/driver/trips')).json.find((x: any) => x.reference === reference);
  if (snap.advanceAmount - 125 - 250 > 0) {
    assert.equal(dv.driverSettlementStatus, 'PENDING');
    assert.equal((await admin(`/cab-requests/${queued._id}/driver-settled`, { reference: 'DRV-UTR-1' })).status, 200);
    dv = (await driver('/driver/trips')).json.find((x: any) => x.reference === reference);
    assert.equal(dv.driverSettlementStatus, 'SETTLED');
    assert.equal(dv.driverSettlementReference, 'DRV-UTR-1');
    assert.ok(!Number.isNaN(Date.parse(dv.driverSettledAt)));
  }

  // D5: rating once per completed platform trip.
  assert.equal((await owner(`/trips/${ownerTrip.id}/rate`, { stars: 6 })).status, 400);
  assert.equal((await owner(`/trips/${ownerTrip.id}/rate`, { stars: 4.5 })).status, 400);
  r = await owner(`/trips/${ownerTrip.id}/rate`, { stars: 4, comment: 'Good' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.driverRated, true);
  assert.equal(r.json.id, ownerTrip.id);
  assert.equal((await owner(`/trips/${ownerTrip.id}/rate`, { stars: 5 })).status, 409, 'rated once');
  assert.equal((await owner(`/trips/${ownTrip}/rate`, { stars: 5 })).status, 409, 'own-driver trips cannot be rated');
  assert.equal((await owner(`/trips/${ownerTrip.id}/cancel`, {})).status, 409, 'completed trip cannot be cancelled');

  // 6) Payouts: exactly the collected commission, one pending at a time, settle once.
  r = await owner('/payouts/summary');
  assert.equal(r.json.available, 250);
  assert.equal((await owner('/payouts/request', { upiId: 'host@upi', expectedAmount: 999 })).status, 409, 'stale balance refused');
  const [p1, p2] = await Promise.all([owner('/payouts/request', { upiId: 'host@upi' }), owner('/payouts/request', { upiId: 'host@upi' })]);
  assert.equal([p1, p2].filter((x) => x.status === 201).length, 1, 'parallel payout requests: exactly one succeeds');
  const payout = (p1.status === 201 ? p1 : p2).json.payout;
  assert.equal(payout.amount, 250);
  assert.equal((await owner('/payouts/summary')).json.available, 0, 'locked');
  assert.equal((await admin(`/host-payouts/${payout._id}/settle`, {})).status, 400, 'UTR required');
  assert.equal((await admin(`/host-payouts/${payout._id}/settle`, { utrNumber: 'UTR9' })).status, 200);
  assert.equal((await admin(`/host-payouts/${payout._id}/settle`, { utrNumber: 'UTR9' })).status, 409, 'settle once');
  assert.equal((await admin(`/host-payouts/${payout._id}/reject`, { reason: 'x' })).status, 409, 'cannot reject settled');
  ownerTrip = (await owner('/trips')).json.find((x: any) => x.reference === reference);
  assert.equal(ownerTrip.commission, 250);
  assert.equal(ownerTrip.commissionPaid, true);

  // 7) Owner platform dispatch → admin assigns manual driver → paid → cancel ⇒ refund pending → refunded.
  r = await owner('/trips', { guestName: 'B', phone: '9000000003', date: tomorrow, time: '11:00 AM', vehicleType: 'Sedan', dispatchMode: 'PLATFORM', destinations: ['NJP'] });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const ref2 = r.json.reference;
  assert.ok(ref2 && r.json.platform);
  const q2 = (await admin('/cab-requests/pending')).json.items.find((x: any) => x.reference === ref2);
  const assigned = await admin(`/cab-requests/${q2._id}/assign-driver`, { assignedDriverName: 'Phone Driver', assignedDriverPhone: '9811111111', agreedFare: 3000 });
  assert.equal(assigned.status, 200);
  const adv2 = assigned.json.data.advanceAmount;
  assert.equal(assigned.json.data.financialSnapshot.driverShareOfAdvance, adv2 - 150 - 300, 'driver share stored in snapshot');
  assert.equal((await admin(`/cab-requests/${q2._id}/record-payment`, { transactionId: 'UTR2', amount: 3000, method: 'UPI' })).status, 400, 'only the exact advance can be recorded');
  assert.equal((await admin(`/cab-requests/${q2._id}/record-payment`, { transactionId: 'UTR1B', amount: adv2, method: 'UPI' })).status, 409, 'transaction id reuse refused');
  assert.equal((await admin(`/cab-requests/${q2._id}/record-payment`, { transactionId: 'UTR2', amount: adv2, method: 'UPI' })).status, 200);
  r = await owner(`/trips/${r.json.id}/cancel`, { reason: 'guest changed plans' });
  assert.equal(r.json.status, 'CANCELLED');
  assert.equal(r.json.refundStatus, 'PENDING');
  assert.equal((await admin(`/cab-requests/${q2._id}/refund`, { reference: 'RFND1' })).status, 200);
  assert.equal((await owner('/payouts/summary')).json.available, 0, 'cancelled trips never payable');

  // 8) Per-homestay commission override (admin only) and audit trail.
  await admin(`/stayride/tenants/${encodeURIComponent(email)}/controls`, { commissionOverride: { pfPercent: 4, hcPercent: 12, advancePercent: 20 } }, 'PUT');
  r = await owner('/snapshot');
  assert.deepEqual([r.json.commissionRates.pfPercent, r.json.commissionRates.hcPercent], [4, 12]);
  r = await admin('/audit-log');
  const actions = new Set(r.json.items.map((a: any) => a.action));
  for (const a of ['tenant.controls', 'settings.update', 'cab.confirm_quote', 'payment.record', 'payment.void', 'payout.settle', 'payment.refund', 'driver.status']) {
    assert.ok(actions.has(a), `audit log missing ${a}`);
  }

  // ---- Round 3: full platform trips, expiry, ratings average, blocking, bank payouts, self-heal ----
  const { cabModel, payoutModel } = await import('../src/stayride/platform.js');
  const newPlatformTrip = async (time = '10:00 AM') => {
    const t = await owner('/trips', { guestName: 'R', phone: '9000000099', date: tomorrow, time, vehicleType: 'SUV', dispatchMode: 'PLATFORM', destinations: ['Mirik'] });
    assert.equal(t.status, 201, JSON.stringify(t.json));
    return t.json;
  };
  const quoteAndConfirm = async (trip: any, drv: (p: string, b?: any) => any, drvId: string, fare: number) => {
    assert.equal((await drv(`/driver/trips/${trip.reference}/quote`, { quotedFare: fare })).status, 200);
    const c = await owner(`/trips/${trip.id}/confirm-quote`, { driverId: drvId });
    assert.equal(c.status, 200, JSON.stringify(c.json));
    return (await cabModel(false).findOne({ reference: trip.reference }).lean()) as any;
  };
  const pay = async (doc: any, utr: string) =>
    assert.equal((await admin(`/cab-requests/${doc._id}/record-payment`, { transactionId: utr, amount: doc.advanceAmount, method: 'UPI' })).status, 200);

  // Rating average: second completed trip rated 5 -> 4.5 over 2.
  const t3 = await newPlatformTrip();
  const c3 = await quoteAndConfirm(t3, driver, driverId, 3000);
  await pay(c3, 'UTR-R3');
  assert.equal((await driver(`/driver/trips/${t3.reference}/start`, {})).status, 200);
  assert.equal((await driver(`/driver/trips/${t3.reference}/complete`, {})).status, 200);
  assert.equal((await owner(`/trips/${t3.id}/rate`, { stars: 5 })).status, 200);
  const d1Doc: any = await users(false).findById(driverId).lean();
  assert.deepEqual([d1Doc.ratingSum, d1Doc.ratingCount], [9, 2]);
  const t4 = await newPlatformTrip('11:30 AM');
  r = await driver(`/driver/trips/${t4.reference}/quote`, { quotedFare: 1000 });
  ownerTrip = (await owner('/trips')).json.find((x: any) => x.reference === t4.reference);
  assert.equal(ownerTrip.quotes[0].driverRating, 4.5, 'average rating, 1 decimal');
  assert.equal(ownerTrip.quotes[0].driverRatingCount, 2);

  // D3: expiry. Pickup moved > 6h into the past -> EXPIRED for owner, admin and the quoting driver.
  await cabModel(false).updateOne({ reference: t4.reference }, { $set: { date: Date.now() - 2 * day } });
  r = await driver('/driver/trips');
  dv = r.json.find((x: any) => x.reference === t4.reference);
  assert.equal(dv.driverView, 'EXPIRED', 'quoting driver sees it expired, not open');
  ownerTrip = (await owner('/trips')).json.find((x: any) => x.reference === t4.reference);
  assert.equal(ownerTrip.status, 'EXPIRED');
  assert.ok((await admin('/cab-requests?status=EXPIRED')).json.items.some((x: any) => x.reference === t4.reference));
  assert.equal((await driver(`/driver/trips/${t4.reference}/quote`, { quotedFare: 900 })).status, 409, 'expired requests take no quotes');

  // D6: blocking a driver releases unpaid (reopened) and paid (needs reassignment, locked fare) trips.
  r = await call('/v1/auth/signup', { body: { email: 'd2@example.com', password: 'driverpass2', name: 'Driver Two', phone: '9800022222', role: 'driver', vehicleType: 'SUV', vehicleNumber: 'SK01B2222', area: 'Kalimpong' } });
  const d2Id = r.json.driver.id;
  const d2 = (path: string, body?: any) => call('/v1' + path, { token: r.json.accessToken, body });
  assert.equal((await admin(`/stayride/drivers/${d2Id}/status`, { status: 'ACTIVE' }, 'PATCH')).status, 200);
  const tU = await newPlatformTrip('08:00 AM');
  await quoteAndConfirm(tU, d2, d2Id, 2000);
  const tP = await newPlatformTrip('09:00 AM');
  const cP = await quoteAndConfirm(tP, d2, d2Id, 2200);
  await pay(cP, 'UTR-P1');
  assert.equal((await admin(`/stayride/drivers/${d2Id}/status`, { status: 'BLOCKED', reason: 'test' }, 'PATCH')).status, 200);
  const relU: any = await cabModel(false).findOne({ reference: tU.reference }).lean();
  assert.equal(relU.assignedDriverUserId, null);
  assert.ok(['FINDING_DRIVER', 'QUOTE_RECEIVED'].includes(relU.status), 'unpaid trip reopened for quotes');
  assert.equal(relU.agreedFare, 0);
  assert.equal((await owner('/trips')).json.find((x: any) => x.reference === tU.reference).status, 'FINDING_DRIVER');
  const relP: any = await cabModel(false).findOne({ reference: tP.reference }).lean();
  assert.equal(relP.assignedDriverUserId, null);
  assert.equal(relP.needsReassignment, true);
  assert.equal(relP.status, 'CONFIRMED');
  assert.equal(relP.agreedFare, 2200);
  assert.equal((await admin(`/cab-requests/${relP._id}/start`, {})).status, 409, 'no start without a driver');
  r = await admin(`/cab-requests/${relP._id}/assign-driver`, { driverUserId: driverId, agreedFare: 99999 });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.data.agreedFare, 2200, 'locked fare kept on reassignment');
  assert.equal(r.json.data.needsReassignment, false);
  assert.equal(r.json.data.assignedDriverUserId, driverId);

  // O3: bank-transfer payout validation; owner sees the account masked, admin sees it in full.
  const avail = (await owner('/payouts/summary')).json.available;
  assert.ok(avail > 0, 'trip 3 commission is payable');
  const bank = { accountName: 'Host Name', accountNumber: '123456789012', ifsc: 'HDFC0001234', bankName: 'HDFC' };
  assert.equal((await owner('/payouts/request', { method: 'CASH' })).status, 400);
  assert.equal((await owner('/payouts/request', { method: 'BANK_TRANSFER' })).status, 400, 'bank required');
  assert.equal((await owner('/payouts/request', { method: 'BANK_TRANSFER', bank: { ...bank, ifsc: 'HDFC1234' } })).status, 400, 'bad IFSC');
  assert.equal((await owner('/payouts/request', { method: 'BANK_TRANSFER', bank: { ...bank, accountNumber: '12ab' } })).status, 400, 'bad account number');
  assert.equal((await owner('/payouts/request', { method: 'BANK_TRANSFER', bank: { ...bank, accountName: '' } })).status, 400, 'name required');
  r = await owner('/payouts/request', { method: 'BANK_TRANSFER', payoutMethod: 'UPI', bank: { ...bank, ifsc: 'hdfc0001234' } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.payout.method, 'BANK_TRANSFER', 'method wins over legacy payoutMethod');
  assert.equal(r.json.payout.bank.accountNumber, '****9012');
  const bankPayoutId = r.json.payout._id;
  const hist = (await owner('/payouts/history')).json.find((p: any) => p._id === bankPayoutId);
  assert.deepEqual([hist.method, hist.bank.ifsc, hist.bank.accountNumber], ['BANK_TRANSFER', 'HDFC0001234', '****9012']);
  const adminView = (await admin('/host-payouts?status=PENDING')).json.items.find((p: any) => String(p._id) === bankPayoutId);
  assert.equal(adminView.bank.accountNumber, '123456789012');

  // Reject self-heal: a reject whose unlock step never ran leaves no trip locked forever.
  await payoutModel(false).updateOne({ _id: bankPayoutId }, { $set: { status: 'REJECTED' } });
  assert.ok(await cabModel(false).exists({ hostPayoutId: bankPayoutId }), 'simulated interrupted reject');
  assert.equal((await owner('/payouts/summary')).json.available, avail, 'summary releases trips of a rejected payout');
  assert.equal(await cabModel(false).countDocuments({ hostPayoutId: bankPayoutId }), 0);
  r = await owner('/payouts/request', { upiId: 'host@upi' });
  assert.equal(r.status, 201);
  assert.equal((await admin(`/host-payouts/${r.json.payout._id}/reject`, { reason: 'wrong UPI' })).status, 200);
  assert.equal((await owner('/payouts/summary')).json.available, avail, 'normal reject unlocks');

  // 10) Non-owner accounts can't use the owner API; bad input types are 400 not 500.
  assert.equal((await call('/v1/auth/login', { body: { email: { $gt: '' }, password: 'x' } })).status, 400);
  const userId = jwt.verify(tok, config.jwtSecret, { audience: 'stayride' }) as any;
  const { userModel } = await import('../src/stayride/platform.js');
  await userModel(false).updateOne({ _id: userId.id }, { $set: { accountStatus: 'BLOCKED' } });
  assert.equal((await owner('/rooms')).status, 403, 'blocked user loses access immediately, even with a valid token');
  await userModel(false).updateOne({ _id: userId.id }, { $set: { accountStatus: 'ACTIVE' } });

  // 9) Blocked driver loses access immediately.
  await admin(`/stayride/drivers/${driverId}/status`, { status: 'BLOCKED', reason: 'test' }, 'PATCH');
  assert.equal((await driver('/driver/trips')).status, 403);

  // ---- Round 3 (server-B): idempotency, validation, sessions, admin users/tenant data, CORS ----
  {
    // S2 + S1 for admin login: generic message, token carries tv
    let a = await call('/api/v1/auth/login', { body: { email: 'admin@example.com', password: 'wrongpass' } });
    assert.equal(a.json.error, 'Invalid email or password.');
    a = await call('/api/v1/auth/login', { body: { email: 'nobody@example.com', password: 'wrongpass' } });
    assert.equal(a.json.error, 'Invalid email or password.', 'admin login: no account-existence leak');
    a = await call('/api/v1/auth/login', { body: { email: 'admin@example.com', password: 'adminpass123' } });
    assert.equal(a.status, 200, JSON.stringify(a.json));
    assert.equal((await call('/api/v1/admin/host-payouts', { token: a.json.data.token })).status, 200);
  }
  // O1 idempotent create: same key twice -> one record, same body; concurrent duplicates never double-create.
  const idem = (path: string, body: any, key: string) => call('/v1' + path, { token: tok, body, headers: { 'Idempotency-Key': key } });
  const roomsBefore = (await owner('/rooms')).json.length;
  const g1 = await idem('/rooms', { number: 'IDEM1', type: 'Std', floor: '1', price: 1500, status: 'AVAILABLE', note: '' }, 'key-room-1');
  const g2 = await idem('/rooms', { number: 'IDEM1', type: 'Std', floor: '1', price: 1500, status: 'AVAILABLE', note: '' }, 'key-room-1');
  assert.equal(g1.status, 201);
  assert.equal(g2.status, 201);
  assert.deepEqual(g2.json, g1.json, 'replay returns the original body');
  const par = await Promise.all([1, 2, 3].map(() => idem('/rooms', { number: 'IDEM2', type: 'Std', floor: '1', price: 1500 }, 'key-room-2')));
  assert.ok(par.every((x) => x.status === 201 || x.status === 409), 'concurrent duplicates: replay or in-progress');
  assert.equal((await owner('/rooms')).json.length, roomsBefore + 2, 'exactly one record per key');
  assert.equal((await idem('/rooms', { number: 'X' }, 'k'.repeat(101))).status, 400, 'key > 100 chars rejected');
  // O4 validation
  assert.equal((await owner('/rooms', { number: 'BAD', price: 'abc' })).status, 400, 'non-numeric price -> 400');
  assert.equal((await owner('/rooms', { number: 'BAD', price: -5 })).status, 400, 'negative price -> 400');
  assert.equal((await owner('/rooms', { number: 'BAD', status: 'HACKED' })).status, 400, 'bad enum -> 400');
  const png = 'data:image/png;base64,' + Buffer.from('fake-png').toString('base64');
  assert.equal((await owner('/homestay', { photos: Array(7).fill(png) }, 'PUT')).status, 400, 'max 6 photos');
  assert.equal((await owner('/homestay', { photos: ['http://insecure.example/x.jpg'] }, 'PUT')).status, 400, 'https only');
  assert.equal((await owner('/homestay', { photos: ['data:image/png;base64,' + 'A'.repeat(600 * 1024)] }, 'PUT')).status, 400, 'photo size cap');
  r = await owner('/homestay', { photos: [png, 'https://cdn.example.com/a.jpg'], link: 'https://evil.example' }, 'PUT');
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.photos.length, 2);
  assert.notEqual(r.json.link, 'https://evil.example', 'public link is server-owned');
  // O2 blank new homestay with unique random link
  r = await call('/v1/auth/signup', { body: { email: 'fresh@example.com', password: 'freshpass1', name: 'Fresh Host', homestayName: 'Hill Top' } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const freshTok = r.json.accessToken;
  const freshHome = (await call('/v1/homestay', { token: freshTok })).json;
  assert.deepEqual([freshHome.description, freshHome.location, freshHome.amenities, freshHome.ownerName], ['', '', [], 'Fresh Host']);
  assert.match(freshHome.link, /\/h\/hill-top-[a-z0-9]{6}$/);
  // S2 generic login message
  const m1 = (await call('/v1/auth/login', { body: { email: 'nobody@example.com', password: 'whatever1' } })).json.error.message;
  const m2 = (await call('/v1/auth/login', { body: { email, password: 'wrongpass1' } })).json.error.message;
  assert.equal(m1, 'Invalid email or password.');
  assert.equal(m2, m1, 'no account-existence leak');
  // S1 logout-all revokes access + refresh
  r = await call('/v1/auth/login', { body: { email: 'fresh@example.com', password: 'freshpass1' } });
  const [acc2, refTok2] = [r.json.accessToken, r.json.refreshToken];
  assert.equal((await call('/v1/auth/logout-all', { token: acc2, body: {} })).status, 200);
  assert.equal((await call('/v1/rooms', { token: acc2 })).status, 401, 'access token revoked');
  r = await call('/v1/auth/refresh', { body: { refreshToken: refTok2 } });
  assert.equal(r.status, 401);
  assert.equal(r.json.error.code, 'SESSION_REVOKED', 'refresh token revoked');
  assert.equal((await call('/v1/rooms', { token: freshTok })).status, 401, 'every earlier session ends');
  // O5 blocked -> 403 ACCOUNT_BLOCKED, unblocked -> next snapshot works with the same token
  await admin(`/stayride/tenants/${encodeURIComponent(email)}/controls`, { blocked: true }, 'PUT');
  assert.equal((await owner('/snapshot')).json.error.code, 'ACCOUNT_BLOCKED');
  await admin(`/stayride/tenants/${encodeURIComponent(email)}/controls`, { blocked: false }, 'PUT');
  assert.equal((await owner('/snapshot')).status, 200);
  // A1 paginated admin lists
  for (const path of ['/stayride/tenants', '/stayride/users', '/stayride/drivers', '/cab-requests', '/cab-requests/pending', '/host-payouts', '/appeals', '/audit-log']) {
    r = await admin(`${path}?page=1&limit=2`);
    assert.equal(r.status, 200, path);
    assert.ok(Array.isArray(r.json.items) && typeof r.json.total === 'number' && r.json.page === 1 && r.json.limit === 2, `${path} paged shape`);
    assert.ok(r.json.items.length <= 2);
  }
  assert.equal((await admin('/audit-log?limit=1000')).json.limit, 100, 'limit capped at 100');
  r = await admin(`/stayride/users?q=${encodeURIComponent('fresh@')}`);
  assert.equal(r.json.total, 1);
  const freshUser = r.json.items[0];
  assert.deepEqual([freshUser.tenantKey, freshUser.role, typeof freshUser.id], ['fresh@example.com', 'owner', 'string']);
  assert.equal((await admin(`/stayride/users?search=${encodeURIComponent('fresh@')}`)).json.total, 1, 'search alias');
  // A2 users: self-protection, revoke, soft delete
  const adminId = String(adminDoc._id);
  assert.equal((await admin(`/stayride/users/${adminId}`, undefined, 'DELETE')).status, 409, 'cannot delete self');
  assert.equal((await admin(`/stayride/users/${adminId}/status`, { status: 'BLOCKED' }, 'PATCH')).status, 409, 'cannot block self');
  assert.equal((await admin(`/stayride/users/${adminId}/role`, { role: 'owner' }, 'PATCH')).status, 409, 'cannot demote self');
  assert.equal((await admin('/stayride/users/not-an-id/status', { status: 'BLOCKED' }, 'PATCH')).status, 404);
  r = await call('/v1/auth/login', { body: { email: 'fresh@example.com', password: 'freshpass1' } });
  const acc3 = r.json.accessToken;
  assert.equal((await admin(`/stayride/users/${freshUser.id}/revoke-sessions`, { reason: 'lost phone' })).status, 200);
  assert.equal((await call('/v1/rooms', { token: acc3 })).status, 401, 'admin revoke ends sessions');
  r = await call('/v1/auth/login', { body: { email: 'fresh@example.com', password: 'freshpass1' } });
  const acc4 = r.json.accessToken;
  r = await call(`/api/v1/admin/stayride/users/${freshUser.id}`, { token: adminToken, method: 'DELETE', body: { reason: 'requested' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.data.accountStatus, 'BLOCKED');
  assert.ok(r.json.data.deletedAt);
  assert.equal((await call('/v1/rooms', { token: acc4 })).status, 401, 'deleted user loses sessions');
  // S3 admin re-checked on every request
  const admin2: any = await adminUsers(false).create({ name: 'Admin2', email: 'admin2@example.com', password: 'adminpass123', role: 'admin', accountStatus: 'ACTIVE' });
  const admin2Token = (await call('/api/v1/auth/login', { body: { email: 'admin2@example.com', password: 'adminpass123' } })).json.data.token;
  assert.equal((await call('/api/v1/admin/host-payouts', { token: admin2Token })).status, 200);
  assert.equal((await admin(`/stayride/users/${admin2._id}/status`, { status: 'BLOCKED', reason: 'test' }, 'PATCH')).status, 200);
  assert.ok([401, 403].includes((await call('/api/v1/admin/host-payouts', { token: admin2Token })).status), 'blocked admin rejected at once');
  assert.equal((await admin(`/stayride/users/${admin2._id}/status`, { status: 'ACTIVE' }, 'PATCH')).status, 200);
  assert.equal((await admin(`/stayride/users/${admin2._id}/revoke-sessions`, {})).status, 200);
  assert.equal((await call('/api/v1/admin/host-payouts', { token: admin2Token })).status, 401, 'revoked admin token rejected');
  // A3 tenant data: view, edit (validated), delete; platform trips refused
  const tk = encodeURIComponent(email);
  r = await admin(`/stayride/tenants/${tk}/data`);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json.rooms) && Array.isArray(r.json.trips) && typeof r.json.version === 'number');
  const room0 = r.json.rooms[0];
  const platformTrip = r.json.trips.find((x: any) => x.reference);
  const ownTripAdmin = r.json.trips.find((x: any) => !x.reference);
  r = await admin(`/stayride/tenants/${tk}/rooms/${room0.id}`, { price: 2222, note: 'fixed by admin' }, 'PATCH');
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.data.price, 2222);
  assert.equal((await admin(`/stayride/tenants/${tk}/rooms/${room0.id}`, { price: 'x' }, 'PATCH')).status, 400, 'admin edits validated');
  assert.equal((await admin(`/stayride/tenants/${tk}/nope/1`, { a: 1 }, 'PATCH')).status, 404);
  assert.equal((await admin(`/stayride/tenants/${tk}/trips/${platformTrip.id}`, { guestName: 'x' }, 'PATCH')).json.error.code, 'PLATFORM_MANAGED');
  assert.equal((await admin(`/stayride/tenants/${tk}/trips/${platformTrip.id}`, undefined, 'DELETE')).status, 409);
  assert.equal((await admin(`/stayride/tenants/${tk}/trips/${ownTripAdmin.id}`, undefined, 'DELETE')).status, 200);
  assert.equal((await admin(`/stayride/tenants/${tk}/rooms/${room0.id}`, undefined, 'DELETE')).status, 200);
  assert.equal((await admin(`/stayride/tenants/${tk}/homestay`, { description: 'Edited' }, 'PATCH')).json.data.description, 'Edited');
  assert.equal((await admin('/stayride/tenants/ghost%40example.com/data')).status, 404, 'unknown tenant is not created');
  const acts = new Set((await admin('/audit-log?limit=100')).json.items.map((a: any) => a.action));
  for (const a of ['tenant.data.update', 'tenant.data.delete', 'tenant.homestay.update', 'user.delete', 'user.revoke_sessions']) assert.ok(acts.has(a), `audit missing ${a}`);
  // A4 demo settings route
  r = await admin('/commission/settings?demo=true');
  assert.equal(r.status, 200);
  assert.equal(r.json.data.isDemo, true);
  r = await call('/api/v1/admin/commission/settings?demo=true', { token: adminToken, method: 'PUT', body: { globalPlatformFeePercent: 6, globalHomestayCommissionPercent: 9 } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal((await admin('/commission/settings')).json.data.globalPlatformFeePercent, 5, 'demo settings never touch live settings');
  assert.ok((await admin('/audit-log?demo=true')).json.items.some((a: any) => a.action === 'settings.update'), 'demo change audited in demo db');
  // Legacy admin: settle needs a reference, bad ids are 404, status enum enforced
  assert.equal((await admin('/payouts/not-an-id/settle', { settlementReference: 'UTR' }, 'PATCH')).status, 404);
  assert.equal((await admin(`/payouts/${new mongoose.Types.ObjectId()}/settle`, {}, 'PATCH')).status, 400, 'reference required');
  assert.equal((await admin(`/payouts/${new mongoose.Types.ObjectId()}/settle`, { settlementReference: 'UTR' }, 'PATCH')).status, 404);
  assert.equal((await admin(`/properties/${new mongoose.Types.ObjectId()}/status`, { status: 'hacked' }, 'PATCH')).status, 400);
  assert.equal((await admin('/overview')).status, 200);
  // CORS: unknown origin -> 403 (not 500), localhost allowed when not deployed
  assert.equal((await call('/health', { headers: { Origin: 'https://evil.example' } })).status, 403, 'rejected origin -> 403');
  assert.equal((await call('/health', { headers: { Origin: 'https://foo.vercel.app' } })).status, 403, 'no *.vercel.app wildcard');
  assert.equal((await call('/health', { headers: { Origin: 'http://localhost:3000' } })).status, 200);
  assert.equal((await call('/health', { headers: { Origin: 'https://stayride.in' } })).status, 200, 'guest web origin allowed');
  // Shared rate-limit store keeps its counters in Mongo
  assert.ok((await mongoose.connection.db!.collection('ratelimits').countDocuments()) > 0, 'rate limits stored in Mongo');
  console.log('✓ all StayRide security + money checks passed');
} finally {
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
}
