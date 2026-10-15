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

  // ---- Payouts / admin / guest-link / payment flow ----
  const { config } = await import('../src/config/env.js');
  const jwt = (await import('jsonwebtoken')).default;
  const adminToken = jwt.sign({ id: 'admin1', email: 'admin@example.com', name: 'Admin', role: 'admin' }, config.jwtSecret);
  const ownerAsAdmin = jwt.sign({ id: 'o1', email, name: 'Host', role: 'owner' }, config.jwtSecret);

  // Owner/StayRide tokens can't reach admin payouts; old StayRide admin routes are gone.
  assert.equal((await call('/api/v1/stayride/admin/payouts', { token: accessToken })).status, 404);
  assert.equal((await call('/api/v1/admin/host-payouts', { token: accessToken })).status, 401);
  assert.equal((await call('/api/v1/admin/host-payouts', { token: ownerAsAdmin })).status, 403);
  assert.equal((await call('/api/v1/admin/host-payouts', { token: adminToken })).status, 200);

  // Public endpoints: no ?host= tenant selection, no unauthenticated payment.
  r = await call('/v1/public/cab-requests', { body: { hostEmail: email, guestName: 'x', guestPhone: '1' } });
  assert.equal(r.status, 401, 'old host-based public create must be gone');
  r = await call('/v1/public/cab-requests/REQ-1/pay-advance', { body: { amount: 99999 } });
  assert.equal(r.status, 401, 'public pay-advance must be gone');
  r = await call('/v1/public/guest-links/' + 'a'.repeat(43));
  assert.equal(r.status, 404, 'unknown token rejected');

  // Owner creates a secure guest link; guest uses it.
  const login = await call('/v1/auth/login', { body: { email, password: 'newpass123' } });
  const tok = login.json.accessToken;
  r = await call('/v1/guest-links', { token: tok, body: { guestName: 'Asha', guestPhone: '+91 90000 11111' } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const t = new URL(r.json.url).searchParams.get('t')!;
  assert.ok(t && t.length >= 40, 'random token in link');
  assert.ok(!r.json.url.includes('@') && !r.json.url.includes('90000'), 'no host email / phone in link');

  r = await call(`/v1/public/guest-links/${t}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.guestName, 'Asha');

  const tomorrow = Date.now() + 86400000;
  const reqBody = { guestName: 'Asha', guestPhone: '+91 90000 11111', destinations: ['Tiger Hill', 'Batasia Loop'], isRoundTrip: false, date: tomorrow, time: '09:00 AM', passengers: 2, vehicleType: 'SUV', clientRequestId: 'c-1' };
  r = await call(`/v1/public/guest-links/${t}/cab-requests`, { body: { ...reqBody, date: Date.now() - 3 * 86400000 } });
  assert.equal(r.status, 400, 'past date rejected');
  r = await call(`/v1/public/guest-links/${t}/cab-requests`, { body: { ...reqBody, isRoundTrip: true } });
  assert.equal(r.status, 400, 'round trip without return rejected');
  r = await call(`/v1/public/guest-links/${t}/cab-requests`, { body: reqBody });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const reference = r.json.reference;
  assert.match(reference, /^REQ-[0-9A-F]{10}$/);
  r = await call(`/v1/public/guest-links/${t}/cab-requests`, { body: reqBody });
  assert.equal(r.json.reference, reference, 'retry with same clientRequestId is idempotent');
  assert.equal((await call(`/v1/public/cab-requests/${reference}`)).status, 404, 'status needs the token');
  assert.equal((await call(`/v1/public/cab-requests/${reference}?t=${t}`)).status, 200);

  // Trip shows in the owner app as a guest request; admin queue sees it.
  r = await call('/v1/trips', { token: tok });
  const guestTrips = r.json.filter((x: any) => x.source === 'GUEST_WEB_LINK');
  assert.equal(guestTrips.length, 1, 'exactly one guest trip');
  r = await call('/api/v1/admin/cab-requests/pending', { token: adminToken });
  const queued = r.json.data.find((x: any) => x.reference === reference);
  assert.ok(queued, 'admin queue receives guest request');

  // Admin assigns (₹2,500 -> PF 125 / HC 250 / driver 2,125), records payment.
  r = await call(`/api/v1/admin/cab-requests/${queued._id}/assign-driver`, { token: adminToken, body: { assignedDriverName: 'Pemba', assignedDriverPhone: '9800011111', agreedFare: 2500 } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const snap = r.json.data.financialSnapshot;
  assert.deepEqual([snap.platformFeeAmount, snap.homestayCommissionAmount, snap.driverPayoutAmount], [125, 250, 2125]);
  assert.ok(snap.advanceAmount >= 375 && snap.advanceAmount <= 2500, 'advance covers PF+HC and <= fare');

  // Owner can't inject money fields or complete with an inflated fare.
  const ownerTrip = (await call('/v1/trips', { token: tok })).json.find((x: any) => x.reference === reference);
  assert.equal(ownerTrip.status, 'AWAITING_ADVANCE');
  r = await call(`/api/v1/admin/cab-requests/${queued._id}/record-payment`, { token: adminToken, body: { transactionId: 'UTR123', amount: 1, method: 'UPI' } });
  assert.equal(r.status, 400, 'underpayment rejected');
  r = await call(`/api/v1/admin/cab-requests/${queued._id}/record-payment`, { token: adminToken, body: { transactionId: 'UTR123', amount: snap.advanceAmount, method: 'UPI' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.data.paymentRecordedBy, 'admin@example.com');
  r = await call(`/api/v1/admin/cab-requests/${queued._id}/record-payment`, { token: adminToken, body: { transactionId: 'UTR123', amount: snap.advanceAmount, method: 'UPI' } });
  assert.equal(r.status, 409, 'payment recorded only once');

  r = await call(`/v1/trips/${ownerTrip.id}/confirm-quote`, { token: tok, body: { driverId: 1, agreedFare: 999999 } });
  assert.equal(r.status, 409, 'fare locked after payment');
  r = await call(`/v1/trips/${ownerTrip.id}/complete`, { token: tok, body: { finalFare: 999999 } });
  assert.equal(r.json.commission, 250, 'commission comes from the snapshot');

  r = await call('/v1/trips', { token: tok, body: { guestName: 'X', phone: '1', date: tomorrow, time: '10:00 AM', vehicleType: 'SUV', commission: 99999, advancePaid: true, financialSnapshot: { homestayCommissionAmount: 99999 } } });
  assert.equal(r.status, 201);
  assert.equal(r.json.commission, 0);
  assert.equal(r.json.advancePaid, undefined, 'money fields not mass-assignable');

  // Payouts: only platform-collected commission; one pending at a time; settle once.
  r = await call('/v1/payouts/request', { token: tok, body: { amount: 251, upiId: 'host@upi' } });
  assert.equal(r.status, 400, 'cannot exceed eligible balance');
  const [p1, p2] = await Promise.all([
    call('/v1/payouts/request', { token: tok, body: { amount: 250, upiId: 'host@upi' } }),
    call('/v1/payouts/request', { token: tok, body: { amount: 250, upiId: 'host@upi' } }),
  ]);
  assert.equal([p1, p2].filter((x) => x.status === 201).length, 1, 'parallel payout requests: exactly one succeeds');
  assert.ok([p1, p2].some((x) => x.status === 400 || x.status === 409));
  const payoutId = (p1.status === 201 ? p1 : p2).json.payout._id;
  r = await call(`/api/v1/admin/host-payouts/${payoutId}/settle`, { token: adminToken, body: { utrNumber: 'UTR9' } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  r = await call(`/api/v1/admin/host-payouts/${payoutId}/settle`, { token: adminToken, body: { utrNumber: 'UTR9' } });
  assert.equal(r.status, 409, 'settle only once');
  r = await call(`/v1/trips/${ownerTrip.id}/commission/pay`, { token: tok, body: { paid: false } });
  assert.equal(r.json.commissionPaid, true, 'settled commission cannot be reopened');
  r = await call('/v1/payouts/request', { token: tok, body: { amount: 1, upiId: 'host@upi' } });
  assert.equal(r.status, 400, 'nothing left to claim');

  // Snapshot exposes server commission rates; demo reset is demo-only.
  r = await call('/v1/snapshot', { token: tok });
  assert.deepEqual(r.json.commissionRates, { pfPercent: 5, hcPercent: 10, advancePercent: 15 });
  assert.equal((await call('/v1/demo/reset', { token: tok, method: 'POST' })).status, 403);

  console.log('✓ all StayRide auth checks passed');
} finally {
  server.close();
  await mongoose.disconnect();
  await mongo.stop();
}
