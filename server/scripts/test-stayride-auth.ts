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

const mongo = await MongoMemoryServer.create();
await mongoose.connect(mongo.getUri());
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
  const adminToken = jwt.sign({ id: 'admin1', email: 'admin@example.com', name: 'Admin', role: 'admin' }, config.jwtSecret);
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

  // 2) Mass assignment / own-driver trips carry no money.
  r = await owner('/drivers', { name: 'Own Driver', phone: '9000000002', vehicle: 'Car', vehicleType: 'SUV', seats: 4, area: 'x', trips: [] });
  const ownDriverId = r.json.id;
  r = await owner('/trips', { guestName: 'X', phone: '9000000001', date: tomorrow, time: '10:00 AM', vehicleType: 'SUV', advancePaid: true, commission: 99999, financialSnapshot: { homestayCommissionAmount: 99999 }, reference: 'REQ-HACK' });
  assert.equal(r.status, 201);
  assert.equal(r.json.advancePaid, undefined, 'advancePaid not mass-assignable');
  assert.equal(r.json.reference, undefined, 'reference not mass-assignable');
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
  r = await call('/v1/auth/signup', { body: { email: 'd1@example.com', password: 'driverpass1', name: 'Driver One', phone: '9800011111', role: 'driver', vehicleType: 'SUV', vehicleNumber: 'SK01A1234' } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.driver.status, 'PENDING_APPROVAL');
  const dTok = r.json.accessToken;
  const driverId = r.json.driver.id;
  const driver = (path: string, body?: any) => call('/v1' + path, { token: dTok, body });
  assert.equal((await driver('/driver/trips')).status, 403, 'pending driver blocked');
  assert.equal((await driver('/rooms')).status, 403, 'drivers cannot use owner API');
  assert.equal((await admin(`/stayride/drivers/${driverId}/status`, { status: 'ACTIVE' }, 'PATCH')).status, 200);
  r = await driver('/driver/trips');
  assert.equal(r.status, 200);
  const open = r.json.find((x: any) => x.reference === reference);
  assert.ok(open, 'approved driver sees open request');
  assert.equal(open.phone, undefined, 'no guest phone before assignment');
  assert.equal(open.guestName, undefined, 'no guest name before assignment');

  r = await driver(`/driver/trips/${reference}/quote`, { quotedFare: 2500 });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  let ownerTrip = (await owner('/trips')).json.find((x: any) => x.reference === reference);
  assert.equal(ownerTrip.quotes.length, 1, 'owner sees the real driver quote');
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

  // Driver can't start before payment.
  assert.equal((await driver(`/driver/trips/${reference}/start`, {})).status, 409);

  const queued = (await admin('/cab-requests/pending')).json.data.find((x: any) => x.reference === reference);
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
  const q2 = (await admin('/cab-requests/pending')).json.data.find((x: any) => x.reference === ref2);
  assert.equal((await admin(`/cab-requests/${q2._id}/assign-driver`, { assignedDriverName: 'Phone Driver', assignedDriverPhone: '9811111111', agreedFare: 3000 })).status, 200);
  assert.equal((await admin(`/cab-requests/${q2._id}/record-payment`, { transactionId: 'UTR1B', amount: 600, method: 'UPI' })).status, 409, 'transaction id reuse refused');
  assert.equal((await admin(`/cab-requests/${q2._id}/record-payment`, { transactionId: 'UTR2', amount: 600, method: 'UPI' })).status, 200);
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
  const actions = new Set(r.json.data.map((a: any) => a.action));
  for (const a of ['tenant.controls', 'settings.update', 'cab.confirm_quote', 'payment.record', 'payment.void', 'payout.settle', 'payment.refund', 'driver.status']) {
    assert.ok(actions.has(a), `audit log missing ${a}`);
  }

  // 9) Blocked driver loses access immediately.
  await admin(`/stayride/drivers/${driverId}/status`, { status: 'BLOCKED', reason: 'test' }, 'PATCH');
  assert.equal((await driver('/driver/trips')).status, 403);
  console.log('✓ all StayRide security + money checks passed');
} finally {
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
}
