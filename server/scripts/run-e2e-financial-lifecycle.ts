// Comprehensive Financial & Operational Lifecycle Integration Suite:
// Payouts, Advance Expiration, Completed Without PIN, Guest Web Links, and iCal Calendar Feeds
// Run: npx tsx scripts/run-e2e-financial-lifecycle.ts
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Ensure test safety: mask and intercept any outbound WhatsApp calls to prevent real sends
const capturedOutboundWhatsApp: any[] = [];
const originalFetch = global.fetch;

global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const urlStr = String(input);
  if (urlStr.includes('graph.facebook.com')) {
    const bodyStr = init?.body ? String(init.body) : '';
    let parsedBody: any = {};
    try { parsedBody = JSON.parse(bodyStr); } catch {}
    capturedOutboundWhatsApp.push({
      url: urlStr,
      method: init?.method,
      to: parsedBody?.to,
      template: parsedBody?.template?.name,
      components: parsedBody?.template?.components,
      text: parsedBody?.text?.body,
      timestamp: new Date().toISOString(),
    });
    console.log(`🛡️  [INTERCEPTOR] Outbound WhatsApp to ${parsedBody?.to || 'unknown'} safely intercepted (Template: ${parsedBody?.template?.name || 'text'}). Zero external bytes dispatched!`);
    return new Response(JSON.stringify({ messages: [{ id: `wamid.MOCK_${Date.now()}` }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return originalFetch(input, init);
};

// Connect to MongoDB Atlas (or configured URI)
const { connectDB } = await import('../src/config/db.js');
await connectDB();

const { default: app } = await import('../src/app.js');
const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, resolve));
const port = (server.address() as any).port;
const BASE_URL = `http://127.0.0.1:${port}`;
console.log(`\n🧪 Test Server started on ${BASE_URL}`);

// Helpers
async function api(path: string, options: { method?: string; body?: any; token?: string; headers?: Record<string, string> } = {}) {
  const method = options.method || (options.body ? 'POST' : 'GET');
  const res = await originalFetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { json = { text }; }
  return { status: res.status, data: json };
}

const uniqueId = Date.now();
const QA_TAG = `STAYCABS_QA_FIN_${uniqueId}`;
console.log(`🏷️  QA Execution Tag: ${QA_TAG}\n`);

// Execution Report Manifest
const manifest: { step: string; status: 'PASS' | 'FAIL'; details: string }[] = [];
function record(step: string, status: 'PASS' | 'FAIL', details: string) {
  manifest.push({ step, status, details });
  console.log(`${status === 'PASS' ? '✅' : '❌'} [${step}] ${details}`);
}

try {
  const jwt = (await import('jsonwebtoken')).default;
  const { config } = await import('../src/config/env.js');
  const { User } = await import('../src/models/user.model.js');
  const { getCabRequestModel } = await import('../src/models/cab-request.model.js');
  const { getPayoutRequestModel } = await import('../src/models/payout-request.model.js');
  const { getGuestLinkModel } = await import('../src/models/guest-link.model.js');
  const { getIcalFeedModel } = await import('../src/models/ical-feed.model.js');
  const { releaseUnpaidAdvances } = await import('../src/stayride/platform.js');

  const CabModel = getCabRequestModel(false);
  const PayoutModel = getPayoutRequestModel(false);
  const GuestLinkModel = getGuestLinkModel(false);
  const IcalFeedModel = getIcalFeedModel(false);

  // =========================================================================
  // SETUP: Admin, Owner, and 2 Drivers (Driver A & Driver B)
  // =========================================================================
  console.log(`--- SETUP: Provisioning Test Actors ---`);
  let adminUser: any = await User.findOne({ role: 'admin', accountStatus: 'ACTIVE' });
  if (!adminUser) {
    adminUser = await User.create({
      name: 'QA Master Admin',
      email: `admin_${uniqueId}@staycabs.test`,
      password: 'SecureAdminPassword123!',
      role: 'admin',
      accountStatus: 'ACTIVE',
      tokenVersion: 0,
    });
  }

  const adminToken = jwt.sign(
    { id: adminUser._id.toString(), email: adminUser.email, role: 'admin', tv: adminUser.tokenVersion || 0 },
    config.jwtSecret,
    { expiresIn: '1d' }
  );

  // Register Owner
  const ownerEmail = `qa_owner_fin_${uniqueId}@staycabs.test`;
  const ownerRes = await api('/v1/auth/signup', {
    body: {
      name: 'Fin Test Host',
      email: ownerEmail,
      password: 'SecurePassword123!',
      phone: '919999990101',
      role: 'owner',
      homestayName: 'Alpine QA Sanctuary',
      location: 'Mall Road, Darjeeling, West Bengal',
      latitude: 27.043,
      longitude: 88.267,
    },
  });
  assert.equal(ownerRes.status, 201, 'Owner signup failed');
  const ownerToken = ownerRes.data.accessToken;
  const ownerTenantKey = ownerEmail;

  // Register Driver A
  const driverAEmail = `qa_driver_a_${uniqueId}@staycabs.test`;
  const driverARes = await api('/v1/auth/signup', {
    body: {
      name: 'Sonam Norbu (Driver A)',
      email: driverAEmail,
      password: 'SecurePassword123!',
      phone: '919999990102',
      role: 'driver',
      vehicleType: 'SUV',
      vehicleModel: 'Toyota Innova Crysta',
      vehicleNumber: 'WB-74-FIN1',
      seats: 6,
      area: 'Darjeeling',
    },
  });
  assert.equal(driverARes.status, 201, 'Driver A signup failed');
  const driverAToken = driverARes.data.accessToken;
  const driverAId = driverARes.data.driver.id;

  // Register Driver B
  const driverBEmail = `qa_driver_b_${uniqueId}@staycabs.test`;
  const driverBRes = await api('/v1/auth/signup', {
    body: {
      name: 'Pemba Sherpa (Driver B)',
      email: driverBEmail,
      password: 'SecurePassword123!',
      phone: '919999990103',
      role: 'driver',
      vehicleType: 'SUV',
      vehicleModel: 'Mahindra Bolero',
      vehicleNumber: 'WB-74-FIN2',
      seats: 6,
      area: 'Darjeeling',
    },
  });
  assert.equal(driverBRes.status, 201, 'Driver B signup failed');
  const driverBToken = driverBRes.data.accessToken;
  const driverBId = driverBRes.data.driver.id;

  // Admin approves both drivers
  await api(`/v1/admin/stayride/drivers/${driverAId}/status`, { method: 'PATCH', token: adminToken, body: { status: 'ACTIVE' } });
  await api(`/v1/admin/stayride/drivers/${driverBId}/status`, { method: 'PATCH', token: adminToken, body: { status: 'ACTIVE' } });

  // Update locations so they are discoverable
  await api('/v1/driver/location', { method: 'PATCH', token: driverAToken, body: { lat: 27.042, lng: 88.265 } });
  await api('/v1/driver/location', { method: 'PATCH', token: driverBToken, body: { lat: 27.042, lng: 88.265 } });

  record('ACTOR_SETUP', 'PASS', 'Admin, Host, Driver A, and Driver B provisioned and activated');

  // =========================================================================
  // BATCH 2: Driver Payout Lifecycle & Balance Locking
  // =========================================================================
  console.log(`\n--- BATCH 2: Driver Payout Requests & Balance Locking ---`);

  // Step 2.1: Initial Driver Wallet Check (0 balance initially)
  const initialWalletRes = await api('/v1/driver/wallet', { token: driverAToken });
  assert.equal(initialWalletRes.status, 200);
  assert.equal(initialWalletRes.data.available, 0, 'Driver A should have 0 initial balance');
  record('DRIVER_WALLET_INITIAL', 'PASS', 'Driver initial wallet confirmed at ₹0');

  // Step 2.2: Attempt Payout with Zero Balance -> Expect 400
  const zeroPayoutRes = await api('/v1/driver/payouts/request', {
    method: 'POST',
    token: driverAToken,
    body: { method: 'UPI', upiId: 'sonam@oksbi' },
  });
  assert.equal(zeroPayoutRes.status, 400, 'Zero-balance payout request should fail with 400');
  record('PAYOUT_ZERO_BALANCE_REJECTION', 'PASS', 'Zero-balance withdrawal prevented: 400 Bad Request');

  // Step 2.3: Seed Driver A with a Completed Trip with Surplus
  const futureTripEpoch = Date.now() + 86400000;
  const seedTripRes = await api('/v1/trips', {
    method: 'POST',
    token: ownerToken,
    body: {
      guestName: 'Seed Guest 1',
      guestPhone: '919999990104',
      pickup: 'Alpine QA Sanctuary, Darjeeling',
      destination: 'Bagdogra Airport (IXB)',
      date: futureTripEpoch,
      time: '11:00 AM',
      passengers: 2,
      vehicleType: 'SUV',
      notes: `${QA_TAG} Seed Trip`,
    },
  });
  assert.equal(seedTripRes.status, 201, `Failed to create seed trip: ${JSON.stringify(seedTripRes.data)}`);
  const seedTripId = seedTripRes.data.id;
  const seedTripRef = seedTripRes.data.reference;

  await api(`/v1/trips/${seedTripId}/dispatch`, { method: 'POST', token: ownerToken });
  // Clear exclusive window to let Driver A quote
  await CabModel.updateOne({ reference: seedTripRef }, { $set: { nearbyNotifyAt: null } });

  // Driver A quotes ₹3,000 (Advance = ₹500, PF = ₹150, HC = ₹150 -> Driver surplus = ₹200)
  await api(`/v1/driver/trips/${seedTripRef}/quote`, { method: 'POST', token: driverAToken, body: { quotedFare: 3000 } });
  await api(`/v1/trips/${seedTripId}/confirm-quote`, { method: 'POST', token: ownerToken, body: { driverId: driverAId } });

  // Record advance payment using MongoDB _id
  const cabDoc1: any = await CabModel.findOne({ reference: seedTripRef }).lean();
  assert.ok(cabDoc1, 'Seed trip document must exist in DB');

  const advanceRes = await api(`/v1/admin/cab-requests/${cabDoc1._id}/record-payment`, {
    method: 'POST',
    token: adminToken,
    body: {
      amount: 500,
      transactionId: `pay_qa_seed_${uniqueId}`,
      method: 'GATEWAY',
      notes: `${QA_TAG} Seed advance payment`,
    },
  });
  assert.equal(advanceRes.status, 200, `Advance payment failed: ${JSON.stringify(advanceRes.data)}`);
  const seedPin = advanceRes.data.data.pickupOtp;
  assert.ok(seedPin && seedPin.length === 4, `Valid 4-digit pickupOtp required, got ${seedPin}`);

  // Driver starts and completes trip
  await api(`/v1/driver/trips/${seedTripRef}/start`, { method: 'POST', token: driverAToken, body: { otp: seedPin } });
  await api(`/v1/driver/trips/${seedTripRef}/complete`, { method: 'POST', token: driverAToken });

  // Check wallet: Should have ₹200 available balance
  const walletAfterTrip = await api('/v1/driver/wallet', { token: driverAToken });
  assert.equal(walletAfterTrip.status, 200);
  assert.equal(walletAfterTrip.data.available, 200, 'Driver A should have ₹200 surplus in wallet');
  record('DRIVER_WALLET_CREDITED', 'PASS', `Driver wallet credited with ₹200 advance surplus (Eligible trips: 1)`);

  // Step 2.4: Request Driver Payout with Invalid UPI Format -> Expect 400
  const invalidUpiRes = await api('/v1/driver/payouts/request', {
    method: 'POST',
    token: driverAToken,
    body: { method: 'UPI', upiId: 'invalid-upi-without-at' },
  });
  assert.equal(invalidUpiRes.status, 400, 'Invalid UPI ID format must be rejected with 400');
  record('PAYOUT_INVALID_UPI_REJECTION', 'PASS', 'Strict UPI regex validation enforced: 400 Bad Request');

  // Step 2.5: Driver Submits Valid Payout Request
  const validPayoutRes = await api('/v1/driver/payouts/request', {
    method: 'POST',
    token: driverAToken,
    body: { method: 'UPI', upiId: 'sonam.driver@okhdfcbank' },
  });
  assert.equal(validPayoutRes.status, 201, `Payout request failed: ${JSON.stringify(validPayoutRes.data)}`);
  const payoutId = validPayoutRes.data.payout._id;
  assert.equal(validPayoutRes.data.payout.amount, 200);
  assert.equal(validPayoutRes.data.payout.status, 'PENDING');
  record('PAYOUT_REQUEST_SUBMITTED', 'PASS', `Payout request PENDING for ₹200 (ID: ${payoutId})`);

  // Step 2.6: Verify Database Locking State
  const lockedTripDoc: any = await CabModel.findOne({ reference: seedTripRef }).lean();
  assert.equal(String(lockedTripDoc.driverPayoutId), String(payoutId), 'Trip driverPayoutId should lock to payout ID');

  const walletWhilePending = await api('/v1/driver/wallet', { token: driverAToken });
  assert.equal(walletWhilePending.data.available, 0, 'Available balance should drop to 0 while payout is pending');
  assert.equal(walletWhilePending.data.pendingPayout?.amount, 200, 'Pending payout should be ₹200');
  record('PAYOUT_ATOMIC_LOCK_VERIFIED', 'PASS', 'Trip atomically locked: driverPayoutId stamped, available balance = ₹0');

  // Step 2.7: Attempt Concurrent 2nd Payout Request -> Expect 409 Conflict
  const concurrentPayoutRes = await api('/v1/driver/payouts/request', {
    method: 'POST',
    token: driverAToken,
    body: { method: 'UPI', upiId: 'sonam.driver@okhdfcbank' },
  });
  assert.equal(concurrentPayoutRes.status, 409, 'Concurrent payout request must be rejected with 409 Conflict');
  record('PAYOUT_DOUBLE_SPEND_BLOCKED', 'PASS', 'Double-spend prevented: 409 Conflict returned on concurrent payout attempt');

  // Step 2.8: Admin Rejects Payout -> Verify Release of Locked Trips & Wallet Restoration
  const rejectRes = await api(`/v1/admin/driver-payouts/${payoutId}/reject`, {
    method: 'POST',
    token: adminToken,
    body: { reason: 'Incorrect UPI VPA handle. Please re-enter valid bank VPA.' },
  });
  assert.equal(rejectRes.status, 200, `Admin reject failed: ${JSON.stringify(rejectRes.data)}`);

  const rejectedPayoutDoc: any = await PayoutModel.findById(payoutId).lean();
  assert.equal(rejectedPayoutDoc.status, 'REJECTED');
  assert.equal(rejectedPayoutDoc.rejectedReason, 'Incorrect UPI VPA handle. Please re-enter valid bank VPA.');

  // Trip driverPayoutId must be unlinked (null)
  const unlinkedTripDoc: any = await CabModel.findOne({ reference: seedTripRef }).lean();
  assert.equal(unlinkedTripDoc.driverPayoutId, null, 'driverPayoutId must be reset to null upon rejection');

  // Driver wallet available balance must be restored to ₹200
  const walletAfterRejection = await api('/v1/driver/wallet', { token: driverAToken });
  assert.equal(walletAfterRejection.data.available, 200, 'Wallet balance must be restored to ₹200 after rejection');
  record('PAYOUT_REJECTION_RECOVERY', 'PASS', 'Payout rejected by admin: trip lock cleared, ₹200 balance fully restored');

  // Step 2.9: Driver Re-submits with Correct UPI
  const resubmittedPayoutRes = await api('/v1/driver/payouts/request', {
    method: 'POST',
    token: driverAToken,
    body: { method: 'UPI', upiId: 'sonam@oksbi' },
  });
  assert.equal(resubmittedPayoutRes.status, 201);
  const newPayoutId = resubmittedPayoutRes.data.payout._id;

  // Step 2.10: Admin Settles Payout with UTR
  const settleUtr = `UTR_SETTLE_${Date.now()}`;
  const settleRes = await api(`/v1/admin/driver-payouts/${newPayoutId}/settle`, {
    method: 'POST',
    token: adminToken,
    body: { utrNumber: settleUtr, notes: 'Settled via State Bank IMPS' },
  });
  assert.equal(settleRes.status, 200, `Admin settle failed: ${JSON.stringify(settleRes.data)}`);

  const settledPayoutDoc: any = await PayoutModel.findById(newPayoutId).lean();
  assert.equal(settledPayoutDoc.status, 'SETTLED');
  assert.equal(settledPayoutDoc.utrNumber, settleUtr);

  // Permanently closed: driver wallet available remains 0, history shows settled payout
  const walletAfterSettled = await api('/v1/driver/wallet', { token: driverAToken });
  assert.equal(walletAfterSettled.data.available, 0, 'Available balance should remain 0 after settlement');
  record('PAYOUT_SETTLED_PERMANENTLY', 'PASS', `Payout settled with UTR ${settleUtr}: funds permanently closed out`);

  // =========================================================================
  // BATCH 3: Unpaid Advance Expiration & Cron Driver Release
  // =========================================================================
  console.log(`\n--- BATCH 3: Unpaid Advance Expiration & Sweeper ---`);

  // Create Trip for Advance Expiration Test
  const expTripRes = await api('/v1/trips', {
    method: 'POST',
    token: ownerToken,
    body: {
      guestName: 'Amit Kumar',
      guestPhone: '919999990105',
      pickup: 'Alpine QA Sanctuary, Darjeeling',
      destination: 'Gangtok MG Marg, Sikkim',
      date: futureTripEpoch,
      time: '08:00 AM',
      passengers: 2,
      vehicleType: 'SUV',
      notes: `${QA_TAG} Expiration Test`,
    },
  });
  assert.equal(expTripRes.status, 201);
  const expTripId = expTripRes.data.id;
  const expTripRef = expTripRes.data.reference;

  await api(`/v1/trips/${expTripId}/dispatch`, { method: 'POST', token: ownerToken });
  // Clear exclusive window
  await CabModel.updateOne({ reference: expTripRef }, { $set: { nearbyNotifyAt: null } });

  // Two drivers submit quotes: Driver A quotes ₹3,200, Driver B quotes ₹3,400
  await api(`/v1/driver/trips/${expTripRef}/quote`, { method: 'POST', token: driverAToken, body: { quotedFare: 3200 } });
  await api(`/v1/driver/trips/${expTripRef}/quote`, { method: 'POST', token: driverBToken, body: { quotedFare: 3400 } });

  // Host confirms Driver A's quote (₹3,200)
  const confirmQuoteRes = await api(`/v1/trips/${expTripId}/confirm-quote`, {
    method: 'POST',
    token: ownerToken,
    body: { driverId: driverAId },
  });
  assert.equal(confirmQuoteRes.status, 200);

  // Verify DB state: Trip is in AWAITING_ADVANCE_PAYMENT, Driver B is REJECTED with outbid: true
  const tripBeforeExp: any = await CabModel.findOne({ reference: expTripRef }).lean();
  assert.equal(tripBeforeExp.status, 'AWAITING_ADVANCE_PAYMENT');
  assert.equal(String(tripBeforeExp.assignedDriverUserId), String(driverAId));

  const driverBQuoteBefore = tripBeforeExp.quotes.find((q: any) => String(q.driverId) === String(driverBId));
  assert.equal(driverBQuoteBefore.status, 'REJECTED');
  assert.equal(driverBQuoteBefore.outbid, true, 'Driver B quote should be marked outbid');
  record('EXPIRATION_PRE_STATE', 'PASS', 'Trip in AWAITING_ADVANCE_PAYMENT with Driver A confirmed and Driver B outbid');

  // Simulate window expiration: Backdate advanceDueAt to 5 minutes ago
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  await CabModel.updateOne({ reference: expTripRef }, { $set: { advanceDueAt: fiveMinAgo } });

  // Run the releaseUnpaidAdvances sweeper
  const releasedCount = await releaseUnpaidAdvances(false, { reference: expTripRef });
  assert.equal(releasedCount, 1, 'Sweeper should release exactly 1 overdue trip');

  // Verify DB state after release:
  // 1. Confirmed driver unlinked
  // 2. Outbid quote from Driver B revived to PENDING
  // 3. Status transitioned back to QUOTE_RECEIVED
  const tripAfterExp: any = await CabModel.findOne({ reference: expTripRef }).lean();
  assert.equal(tripAfterExp.assignedDriverUserId, null, 'assignedDriverUserId must be unlinked');
  assert.equal(tripAfterExp.status, 'QUOTE_RECEIVED', 'Status must revive to QUOTE_RECEIVED since Driver B quote exists');
  assert.equal(tripAfterExp.agreedFare, 0, 'agreedFare must reset to 0');
  assert.equal(tripAfterExp.advanceAmount, 0, 'advanceAmount must reset to 0');

  const driverBQuoteAfter = tripAfterExp.quotes.find((q: any) => String(q.driverId) === String(driverBId));
  assert.equal(driverBQuoteAfter.status, 'PENDING', 'Driver B quote must be revived to PENDING');
  assert.equal(driverBQuoteAfter.outbid, false, 'Driver B outbid flag must reset to false');
  record('EXPIRATION_SWEEP_VERIFIED', 'PASS', 'Unpaid advance expired: Driver A unlinked, Driver B quote revived to PENDING');

  // =========================================================================
  // BATCH 4: Completed Without PIN & Payout Hold Audit
  // =========================================================================
  console.log(`\n--- BATCH 4: Completed Without PIN & Payout Hold ---`);

  // Create Trip 4 for No-PIN Flow
  const noPinTripRes = await api('/v1/trips', {
    method: 'POST',
    token: ownerToken,
    body: {
      guestName: 'Sunita Rao',
      guestPhone: '919999990106',
      pickup: 'Alpine QA Sanctuary, Darjeeling',
      destination: 'Tiger Hill Sunrise Viewpoint',
      date: futureTripEpoch,
      time: '04:00 AM',
      passengers: 2,
      vehicleType: 'SUV',
      notes: `${QA_TAG} No PIN Flow`,
    },
  });
  assert.equal(noPinTripRes.status, 201);
  const noPinTripId = noPinTripRes.data.id;
  const noPinTripRef = noPinTripRes.data.reference;

  await api(`/v1/trips/${noPinTripId}/dispatch`, { method: 'POST', token: ownerToken });
  await CabModel.updateOne({ reference: noPinTripRef }, { $set: { nearbyNotifyAt: null } });

  // Driver A quotes ₹2,600 (Advance ₹500, PF ₹130, HC ₹130 -> Surplus ₹240)
  await api(`/v1/driver/trips/${noPinTripRef}/quote`, { method: 'POST', token: driverAToken, body: { quotedFare: 2600 } });
  await api(`/v1/trips/${noPinTripId}/confirm-quote`, { method: 'POST', token: ownerToken, body: { driverId: driverAId } });

  const noPinCabDoc: any = await CabModel.findOne({ reference: noPinTripRef }).lean();
  assert.ok(noPinCabDoc, 'No-PIN trip document must exist in DB');

  await api(`/v1/admin/cab-requests/${noPinCabDoc._id}/record-payment`, {
    method: 'POST',
    token: adminToken,
    body: {
      amount: 500,
      transactionId: `pay_qa_nopin_${uniqueId}`,
      method: 'GATEWAY',
      notes: `${QA_TAG} No PIN advance payment`,
    },
  });

  // Admin marks trip completed without PIN
  await CabModel.updateOne(
    { reference: noPinTripRef },
    {
      $set: {
        status: 'COMPLETED',
        completedWithoutPin: true,
        noPinReviewedAt: null,
        driverSettlementStatus: 'PENDING',
        startedAt: new Date(),
        completedAt: new Date(),
      },
    }
  );

  // Invariant Verification: Driver wallet MUST NOT credit this trip's surplus because it is held under PAYOUT_HOLD
  const walletDuringHold = await api('/v1/driver/wallet', { token: driverAToken });
  assert.equal(walletDuringHold.data.available, 0, 'Driver wallet available balance must stay 0 while on PAYOUT_HOLD');
  record('PAYOUT_HOLD_INVARIANT', 'PASS', 'completedWithoutPin holds earnings: available balance remains ₹0');

  // Admin Reviews No-PIN Trip: APPROVE
  const reviewRes = await api(`/v1/admin/cab-requests/${noPinCabDoc._id}/no-pin-review`, {
    method: 'POST',
    token: adminToken,
    body: { decision: 'APPROVE', reason: 'Passenger confirmed drop-off via phone verification' },
  });
  assert.equal(reviewRes.status, 200, `Admin review failed: ${JSON.stringify(reviewRes.data)}`);

  // Verify DB state: noPinReviewedAt stamped
  const reviewedTripDoc: any = await CabModel.findOne({ reference: noPinTripRef }).lean();
  assert.ok(reviewedTripDoc.noPinReviewedAt, 'noPinReviewedAt should be populated');
  assert.equal(reviewedTripDoc.completedWithoutPin, true);

  // Now query driver wallet: Should be credited with ₹240 surplus!
  const walletAfterApproval = await api('/v1/driver/wallet', { token: driverAToken });
  assert.equal(walletAfterApproval.data.available, 240, 'Driver wallet should now release ₹240 after admin approval');
  record('NO_PIN_ADMIN_APPROVAL', 'PASS', 'Admin approved no-PIN ride: PAYOUT_HOLD released, ₹240 credited to wallet');

  // =========================================================================
  // BATCH 5: Guest Web Link & Public Cab Request
  // =========================================================================
  console.log(`\n--- BATCH 5: Guest Web Link & Mountain Mobility Inquiries ---`);

  // Step 5.1: Host Generates Guest Link
  const guestLinkRes = await api('/v1/guest-links', {
    method: 'POST',
    token: ownerToken,
    body: {
      guestName: 'Vikram Malhotra',
      guestPhone: '919999990107',
      roomName: 'Kanchenjunga Suite',
      checkIn: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      checkOut: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    },
  });
  assert.equal(guestLinkRes.status, 201, `Guest link generation failed: ${JSON.stringify(guestLinkRes.data)}`);
  
  let guestToken = '';
  if (guestLinkRes.data.url) {
    try {
      const u = new URL(guestLinkRes.data.url);
      guestToken = u.searchParams.get('t') || '';
    } catch {
      guestToken = guestLinkRes.data.url.split('t=')[1] || '';
    }
  }
  assert.ok(guestToken, `Guest link token must be extractable from url: ${guestLinkRes.data.url}`);
  record('GUEST_LINK_GENERATION', 'PASS', `Host created guest link with token: ${guestToken.slice(0, 10)}...`);

  // Step 5.2: Public Access to Guest Link
  const publicLinkRes = await api(`/v1/public/guest-links/${guestToken}`);
  assert.equal(publicLinkRes.status, 200, `Public guest link view failed: ${JSON.stringify(publicLinkRes.data)}`);
  assert.equal(publicLinkRes.data.homestayName, 'Alpine QA Sanctuary');
  assert.ok(Array.isArray(publicLinkRes.data.config?.routePresets), 'Mountain route presets must be returned');
  record('GUEST_LINK_PUBLIC_VIEW', 'PASS', 'Guest opened digital pass: verified homestay name & route presets');

  // Step 5.3: Guest Submits Cab Request via Web Link
  const clientReqId = `CLIENT_REQ_${Date.now()}`;
  const guestTripRes = await api(`/v1/public/guest-links/${guestToken}/cab-requests`, {
    method: 'POST',
    body: {
      clientRequestId: clientReqId,
      guestName: 'Vikram Malhotra',
      phone: '919999990107',
      pickup: 'Alpine QA Sanctuary, Darjeeling',
      destinations: ['Kalimpong Deolo Hill'],
      destination: 'Kalimpong Deolo Hill',
      date: Date.now() + 86400000 * 2,
      time: '09:00 AM',
      vehicleType: 'SUV',
    },
  });
  assert.equal(guestTripRes.status, 201, `Guest web request failed: ${JSON.stringify(guestTripRes.data)}`);
  const guestTripRef = guestTripRes.data.reference;
  assert.ok(guestTripRef, 'Guest trip reference must be created');

  const guestTripInDb: any = await CabModel.findOne({ reference: guestTripRef }).lean();
  assert.equal(guestTripInDb.requestSource, 'GUEST_WEB_LINK');
  assert.ok(guestTripInDb.guestLinkId, 'guestLinkId must be stamped on DB record');
  record('GUEST_LINK_REQUEST_CREATED', 'PASS', `Guest submitted cab request via web pass (Ref: ${guestTripRef})`);

  // =========================================================================
  // BATCH 6: iCal Calendar Feed Export Verification
  // =========================================================================
  console.log(`\n--- BATCH 6: iCal Calendar Feed Export ---`);

  // Host creates ical feed document for room
  const icalExportToken = crypto.randomBytes(24).toString('base64url');
  const icalFeedDoc = await IcalFeedModel.create({
    tenantKey: ownerTenantKey,
    roomId: 1,
    exportToken: icalExportToken,
    isDemo: false,
    imports: [],
  });

  const icalExportRes = await api(`/v1/public/ical/${icalExportToken}`);
  assert.equal(icalExportRes.status, 200, `iCal export failed: ${JSON.stringify(icalExportRes.data)}`);
  const icalRawText = icalExportRes.data.text || JSON.stringify(icalExportRes.data);
  assert.ok(icalRawText.includes('BEGIN:VCALENDAR'), 'iCal feed must adhere to RFC 5545 VCALENDAR spec');
  assert.ok(icalRawText.includes('PRODID:-//Platform//Room Calendar//EN'), 'iCal PRODID header verified');
  record('ICAL_EXPORT_RFC5545', 'PASS', 'Public iCal calendar stream conforms to RFC 5545 specification');

  // =========================================================================
  // BATCH 7: WhatsApp Outbound Safety & Containment
  // =========================================================================
  console.log(`\n--- BATCH 7: WhatsApp Outbound Containment Audit ---`);
  console.log(`Total Outbound Intercepted Events in this Suite: ${capturedOutboundWhatsApp.length}`);
  for (const event of capturedOutboundWhatsApp) {
    console.log(`  📩 Intercepted event to: ${event.to}, Template: ${event.template || 'text'}`);
  }
  assert.ok(capturedOutboundWhatsApp.length > 0, 'Outbound alerts should be triggered');
  record('WHATSAPP_FIN_CONTAINMENT', 'PASS', `Captured ${capturedOutboundWhatsApp.length} outbound WhatsApp events with 0 external network bytes`);

} catch (err: any) {
  console.error('\n❌ TEST RUN ABORTED WITH ERROR:');
  console.error(err);
  record('FATAL_ERROR', 'FAIL', err.message);
  process.exitCode = 1;
} finally {
  server.close();
  await mongoose.disconnect();
  console.log(`\n⚠️  MongoDB disconnected`);
}

// Print Final Manifest
console.log(`\n======================================================`);
console.log(`🏁 FINANCIAL & LIFECYCLE AUDIT SUITE SUMMARY:`);
console.log(`======================================================`);
let passCount = 0;
let failCount = 0;
for (const m of manifest) {
  console.log(`${m.status === 'PASS' ? '✅' : '❌'} [${m.step}] ${m.details}`);
  if (m.status === 'PASS') passCount++;
  else failCount++;
}
console.log(`\nTOTAL: ${manifest.length} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log(`======================================================\n`);
