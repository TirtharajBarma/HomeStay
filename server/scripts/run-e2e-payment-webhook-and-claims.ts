// Comprehensive Payment Gateway (Razorpay Webhooks) & Manual UPI QR Claims Test Suite
// Covers: Razorpay Webhook Signature Verification, payment_link.paid event processing,
// Idempotent duplicate retries, Unmatched underpayments & cancelled trip handling,
// Manual UPI claims, 12-digit UTR validation, Duplicate UTR fraud prevention,
// Admin claim rejection, Guest re-submission, Admin approval, and Payment voiding.
// Run: npx tsx scripts/run-e2e-payment-webhook-and-claims.ts

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Configure simulated Razorpay Gateway secrets for webhook testing
const MOCK_WEBHOOK_SECRET = 'qa_razorpay_webhook_secret_secure_key_123';
process.env.PAYMENT_GATEWAY_MODE = 'razorpay';
process.env.RAZORPAY_KEY_ID = 'rzp_live_qa_mock_key_id';
process.env.RAZORPAY_KEY_SECRET = 'qa_mock_secret_key_456';
process.env.RAZORPAY_WEBHOOK_SECRET = MOCK_WEBHOOK_SECRET;

// =========================================================================
// 1. WhatsApp Containment: Intercept 100% of Meta Graph API calls
// =========================================================================
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

// =========================================================================
// 2. Database Connection & Server Setup
// =========================================================================
const { connectDB } = await import('../src/config/db.js');
await connectDB();

// Clear rate limits on localhost
if (mongoose.connection.db) {
  await mongoose.connection.db.collection('ratelimits').deleteMany({
    _id: { $regex: '127\\.0\\.0\\.1|::ffff:127\\.0\\.0\\.1|::1' },
  });
}

const { default: app } = await import('../src/app.js');
const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, resolve));
const port = (server.address() as any).port;
const BASE_URL = `http://127.0.0.1:${port}`;
console.log(`\n🧪 Test Server started on ${BASE_URL}`);

// Helpers
async function api(path: string, options: { method?: string; body?: any; token?: string; headers?: Record<string, string>; rawBody?: string } = {}) {
  const method = options.method || (options.body || options.rawBody !== undefined ? 'POST' : 'GET');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...options.headers,
  };
  const body = options.rawBody !== undefined ? options.rawBody : options.body ? JSON.stringify(options.body) : undefined;
  const res = await originalFetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body,
  });
  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { json = { text }; }
  return { status: res.status, data: json };
}

function generateRazorpaySignature(rawBody: string, secret = MOCK_WEBHOOK_SECRET): string {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

const uniqueId = Date.now();
const QA_TAG = `STAYCABS_QA_PAY_${uniqueId}`;
console.log(`🏷️  QA Execution Tag: ${QA_TAG}\n`);

// Execution Report Manifest
const manifest: { step: string; status: 'PASS' | 'FAIL'; details: string }[] = [];
function record(step: string, status: 'PASS' | 'FAIL', details: string) {
  manifest.push({ step, status, details });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${step}] ${details}`);
}

try {
  const jwt = (await import('jsonwebtoken')).default;
  const { config } = await import('../src/config/env.js');
  const { User } = await import('../src/models/user.model.js');
  const { CabRequest } = await import('../src/models/cab-request.model.js');
  const { getGuestLinkModel } = await import('../src/models/guest-link.model.js');

  // =========================================================================
  // SETUP: Admin, Homestay Owner, and Verified Driver
  // =========================================================================
  console.log(`--- STEP 0: Test Environment Setup ---`);

  // 1. Admin Token
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

  // 2. Homestay Host Setup
  const hostEmail = `qa_host_pay_${uniqueId}@staycabs.test`;
  const hostPhone = `919999${String(uniqueId).slice(-6)}`;
  const hostSignupRes = await api('/v1/auth/signup', {
    body: {
      name: 'QA Grand Estate Host',
      email: hostEmail,
      password: 'SecurePassword123!',
      phone: hostPhone,
      role: 'owner',
      homestayName: 'Singalila QA Mountain Estate',
      location: 'Chowrasta, Darjeeling, West Bengal',
      latitude: 27.043,
      longitude: 88.268,
    },
  });
  assert.equal(hostSignupRes.status, 201);
  const hostToken = hostSignupRes.data.accessToken;

  // 3. Driver Setup
  const driverEmail = `qa_driver_pay_${uniqueId}@staycabs.test`;
  const driverPhone = `919800${String(uniqueId).slice(-6)}`;
  const driverRes = await api('/v1/auth/signup', {
    body: {
      name: 'Karma Bhutia (Innova Driver)',
      email: driverEmail,
      password: 'SecurePassword123!',
      phone: driverPhone,
      role: 'driver',
      vehicleType: 'SUV',
      vehicleModel: 'Toyota Innova Crysta',
      vehicleNumber: 'WB-74-PAY01',
      seats: 6,
      area: 'Darjeeling',
    },
  });
  assert.equal(driverRes.status, 201);
  const driverId = driverRes.data.driver.id;

  // Approve driver and update location
  await api(`/v1/admin/stayride/drivers/${driverId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'ACTIVE', reason: 'Approved for payment gateway QA' },
  });

  // 4. Create Guest Link
  const guestLinkRes = await api('/v1/guest-links', {
    method: 'POST',
    token: hostToken,
    body: { guestName: 'Siddharth Varma', guestPhone: '919876543210', roomName: 'Mountain Villa' },
  });
  assert.equal(guestLinkRes.status, 201);
  const guestUrl = guestLinkRes.data.url;
  const guestToken = new URL(guestUrl).searchParams.get('t') || guestUrl.split('?t=')[1];
  assert.ok(guestToken, 'Guest token must be valid');

  record('SETUP_ENTITIES', 'PASS', 'Admin, Host, Approved Driver, and Guest Link initialized');

  // =========================================================================
  // TEST 1: Tampered Webhook Signature Rejection (SCEN-078)
  // =========================================================================
  console.log(`\n--- TEST 1: Tampered Webhook Signature Defense (SCEN-078) ---`);
  const fakePayloadStr = JSON.stringify({
    event: 'payment_link.paid',
    payload: { payment_link: { entity: { id: 'plink_fake_123' } } },
  });
  const forgedSig = '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff';

  const tamperedRes = await api('/v1/webhooks/razorpay', {
    method: 'POST',
    rawBody: fakePayloadStr,
    headers: { 'X-Razorpay-Signature': forgedSig },
  });
  assert.equal(tamperedRes.status, 400, 'Tampered signature must return 400 Bad Request');
  assert.equal(tamperedRes.data.error.message, 'Invalid signature.');
  record('TAMPERED_SIGNATURE_REJECTED', 'PASS', 'Forged HMAC SHA256 signature rejected with 400 Bad Request (Zero DB side effects)');

  // =========================================================================
  // TEST 2: Valid Razorpay Webhook Advance Capture (SCEN-077, SCEN-086)
  // =========================================================================
  console.log(`\n--- TEST 2: Valid Razorpay Webhook Advance Capture (SCEN-077, SCEN-086) ---`);
  // Create Trip 1: Darjeeling to Gangtok, budget 3000
  const trip1Res = await api(`/v1/public/guest-links/${guestToken}/cab-requests`, {
    method: 'POST',
    body: {
      clientRequestId: `req_pay_${uniqueId}_1`,
      guestName: 'Siddharth Varma',
      phone: '919876543210',
      pickup: 'Darjeeling Mall',
      destinations: ['Gangtok MG Marg'],
      date: Date.now() + 86400000,
      time: '09:00 AM',
      passengers: 4,
      vehicleType: 'SUV',
    },
  });
  assert.equal(trip1Res.status, 201);
  const tripRef1 = trip1Res.data.reference;

  // Move Trip 1 to AWAITING_ADVANCE_PAYMENT with agreedFare 3000, advanceAmount 500, driver assigned
  const plinkId1 = `plink_qa_${uniqueId}_001`;
  const paymentId1 = `pay_qa_${uniqueId}_001`;
  await CabRequest.updateOne(
    { reference: tripRef1 },
    {
      $set: {
        status: 'AWAITING_ADVANCE_PAYMENT',
        agreedFare: 3000,
        advanceAmount: 500,
        remainingCashAmount: 2500,
        assignedDriverUserId: String(driverId),
        assignedDriverName: 'Karma Bhutia',
        assignedDriverPhone: driverPhone,
        paymentLinkId: plinkId1,
        advancePaid: false,
        financialSnapshot: {
          agreedFare: 3000,
          advanceAmount: 500,
          advancePaid: false,
          platformFeeRate: 5,
          platformFeeAmount: 150,
          homestayCommissionRate: 5,
          homestayCommissionAmount: 150,
          driverPayoutAmount: 2700,
          remainingCashToDriver: 2500,
          driverShareOfAdvance: 200,
          calculatedAt: new Date(),
        },
      },
    }
  );

  // Construct valid Razorpay webhook event payload (amount: 50,000 paise = ₹500)
  const webhookEvent1 = {
    event: 'payment_link.paid',
    payload: {
      payment_link: {
        entity: {
          id: plinkId1,
          notes: { reference: tripRef1 },
        },
      },
      payment: {
        entity: {
          id: paymentId1,
          amount: 50000, // paise = ₹500
          method: 'upi',
        },
      },
    },
  };
  const rawBody1 = JSON.stringify(webhookEvent1);
  const validSig1 = generateRazorpaySignature(rawBody1);

  const webhookRes1 = await api('/v1/webhooks/razorpay', {
    method: 'POST',
    rawBody: rawBody1,
    headers: { 'X-Razorpay-Signature': validSig1 },
  });
  assert.equal(webhookRes1.status, 200, `Webhook processing failed: ${JSON.stringify(webhookRes1.data)}`);
  assert.equal(webhookRes1.data.result, 'RECORDED', 'Result must be RECORDED');

  // Verify MongoDB document state
  const trip1InDb: any = await CabRequest.findOne({ reference: tripRef1 }).lean();
  assert.equal(trip1InDb.status, 'CONFIRMED', 'Trip status must transition to CONFIRMED');
  assert.equal(trip1InDb.advancePaid, true, 'advancePaid must be true');
  assert.equal(trip1InDb.advancePaymentId, paymentId1, 'advancePaymentId must match payment ID');
  assert.equal(trip1InDb.advancePaymentMethod, 'GATEWAY', 'advancePaymentMethod must be GATEWAY');
  assert.ok(trip1InDb.pickupOtp && trip1InDb.pickupOtp.length === 4, '4-digit pickup OTP must be generated');

  record('GATEWAY_ADVANCE_RECORDED', 'PASS', `Razorpay webhook processed: Trip ${tripRef1} CONFIRMED, ₹500 advance recorded, PIN issued: ${trip1InDb.pickupOtp}`);

  // =========================================================================
  // TEST 3: Idempotent Duplicate Webhook Processing (SCEN-079)
  // =========================================================================
  console.log(`\n--- TEST 3: Idempotent Duplicate Webhook (SCEN-079) ---`);
  // Resend the identical webhook event
  const retryWebhookRes1 = await api('/v1/webhooks/razorpay', {
    method: 'POST',
    rawBody: rawBody1,
    headers: { 'X-Razorpay-Signature': validSig1 },
  });
  assert.equal(retryWebhookRes1.status, 200);
  assert.equal(retryWebhookRes1.data.result, 'DUPLICATE', 'Duplicate webhook must return DUPLICATE');

  // Verify DB state unchanged
  const trip1AfterRetry: any = await CabRequest.findOne({ reference: tripRef1 }).lean();
  assert.equal(trip1AfterRetry.status, 'CONFIRMED');
  assert.equal(trip1AfterRetry.advancePaymentId, paymentId1);
  record('WEBHOOK_IDEMPOTENCY', 'PASS', 'Duplicate webhook delivery returned result=DUPLICATE with zero duplicate side effects');

  // =========================================================================
  // TEST 4: Webhook for Cancelled Trip (SCEN-080)
  // =========================================================================
  console.log(`\n--- TEST 4: Webhook for Cancelled Trip (SCEN-080) ---`);
  const plinkId2 = `plink_qa_${uniqueId}_002`;
  const paymentId2 = `pay_qa_${uniqueId}_002`;

  // Create Trip 2 and cancel it
  const trip2Res = await api(`/v1/public/guest-links/${guestToken}/cab-requests`, {
    method: 'POST',
    body: {
      clientRequestId: `req_pay_${uniqueId}_2`,
      guestName: 'Anandita Roy',
      phone: '919876543211',
      pickup: 'Kurseong',
      destinations: ['Siliguri'],
      date: Date.now() + 86400000,
      time: '11:00 AM',
      passengers: 2,
      vehicleType: 'SUV',
    },
  });
  assert.equal(trip2Res.status, 201);
  const tripRef2 = trip2Res.data.reference;

  await CabRequest.updateOne(
    { reference: tripRef2 },
    {
      $set: {
        status: 'CANCELLED',
        cancellationReason: 'Guest changed travel plans',
        paymentLinkId: plinkId2,
        advanceAmount: 500,
      },
    }
  );

  // Webhook arrives for cancelled trip
  const webhookEvent2 = {
    event: 'payment_link.paid',
    payload: {
      payment_link: { entity: { id: plinkId2, notes: { reference: tripRef2 } } },
      payment: { entity: { id: paymentId2, amount: 50000, method: 'upi' } },
    },
  };
  const rawBody2 = JSON.stringify(webhookEvent2);
  const webhookRes2 = await api('/v1/webhooks/razorpay', {
    method: 'POST',
    rawBody: rawBody2,
    headers: { 'X-Razorpay-Signature': generateRazorpaySignature(rawBody2) },
  });
  assert.equal(webhookRes2.status, 200);
  assert.equal(webhookRes2.data.result, 'UNMATCHED', 'Payment on cancelled trip must result in UNMATCHED');

  const trip2InDb: any = await CabRequest.findOne({ reference: tripRef2 }).lean();
  assert.equal(trip2InDb.status, 'CANCELLED', 'Status must remain CANCELLED');
  assert.equal(trip2InDb.advancePaid, false, 'advancePaid must remain false');
  assert.equal(trip2InDb.unmatchedPayments?.length, 1, 'Payment must be logged in unmatchedPayments array');
  assert.equal(trip2InDb.unmatchedPayments[0].paymentId, paymentId2);
  record('CANCELLED_TRIP_PAYMENT_UNMATCHED', 'PASS', 'Late payment on cancelled trip captured into unmatchedPayments for refund; status kept CANCELLED');

  // =========================================================================
  // TEST 5: Underpaid Gateway Amount Handling (SCEN-081)
  // =========================================================================
  console.log(`\n--- TEST 5: Underpaid Gateway Amount (SCEN-081) ---`);
  const plinkId3 = `plink_qa_${uniqueId}_003`;
  const paymentId3 = `pay_qa_${uniqueId}_003`;

  const trip3Res = await api(`/v1/public/guest-links/${guestToken}/cab-requests`, {
    method: 'POST',
    body: {
      clientRequestId: `req_pay_${uniqueId}_3`,
      guestName: 'Rohit Gupta',
      phone: '919876543212',
      pickup: 'Kalimpong',
      destinations: ['Bagdogra'],
      date: Date.now() + 86400000,
      time: '01:00 PM',
      passengers: 3,
      vehicleType: 'SUV',
    },
  });
  assert.equal(trip3Res.status, 201);
  const tripRef3 = trip3Res.data.reference;

  await CabRequest.updateOne(
    { reference: tripRef3 },
    {
      $set: {
        status: 'AWAITING_ADVANCE_PAYMENT',
        advanceAmount: 500,
        paymentLinkId: plinkId3,
        advancePaid: false,
      },
    }
  );

  // Webhook delivers ₹300 instead of ₹500 (30,000 paise)
  const webhookEvent3 = {
    event: 'payment_link.paid',
    payload: {
      payment_link: { entity: { id: plinkId3, notes: { reference: tripRef3 } } },
      payment: { entity: { id: paymentId3, amount: 30000, method: 'upi' } },
    },
  };
  const rawBody3 = JSON.stringify(webhookEvent3);
  const webhookRes3 = await api('/v1/webhooks/razorpay', {
    method: 'POST',
    rawBody: rawBody3,
    headers: { 'X-Razorpay-Signature': generateRazorpaySignature(rawBody3) },
  });
  assert.equal(webhookRes3.status, 200);
  assert.equal(webhookRes3.data.result, 'UNMATCHED', 'Underpayment must be marked UNMATCHED');

  const trip3InDb: any = await CabRequest.findOne({ reference: tripRef3 }).lean();
  assert.equal(trip3InDb.status, 'AWAITING_ADVANCE_PAYMENT', 'Trip must not be confirmed on shortfall');
  assert.equal(trip3InDb.advancePaid, false);
  assert.equal(trip3InDb.unmatchedPayments[0].amount, 300);
  record('UNDERPAID_GATEWAY_HANDLING', 'PASS', 'Underpayment of ₹300 against required ₹500 diverted to unmatchedPayments; trip kept unconfirmed');

  // =========================================================================
  // TEST 6: Manual UPI QR Payment Claim - Verification Gate (SCEN-087)
  // =========================================================================
  console.log(`\n--- TEST 6: Manual UPI Claim & Security Access Gate (SCEN-087) ---`);
  const trip4Res = await api(`/v1/public/guest-links/${guestToken}/cab-requests`, {
    method: 'POST',
    body: {
      clientRequestId: `req_pay_${uniqueId}_4`,
      guestName: 'Meera Sen',
      phone: '919876543213',
      pickup: 'Ghum',
      destinations: ['Darjeeling Mall'],
      date: Date.now() + 86400000,
      time: '03:00 PM',
      passengers: 2,
      vehicleType: 'SUV',
    },
  });
  assert.equal(trip4Res.status, 201);
  const tripRef4 = trip4Res.data.reference;

  await CabRequest.updateOne(
    { reference: tripRef4 },
    {
      $set: {
        status: 'AWAITING_ADVANCE_PAYMENT',
        advanceAmount: 500,
        advancePaid: false,
        advanceDueAt: new Date(Date.now() + 3600000),
        financialSnapshot: {
          agreedFare: 3000,
          advanceAmount: 500,
          advancePaid: false,
          platformFeeRate: 5,
          platformFeeAmount: 150,
          homestayCommissionRate: 5,
          homestayCommissionAmount: 150,
          driverPayoutAmount: 2700,
          remainingCashToDriver: 2500,
          driverShareOfAdvance: 200,
          calculatedAt: new Date(),
        },
      },
    }
  );

  // Unverified claim attempt (no phone or token) -> 403 Forbidden
  const unverifiedClaimRes = await api(`/v1/public/cab-requests/${tripRef4}/payment-claim`, {
    method: 'POST',
    body: { utr: '428192839182' },
  });
  assert.equal(unverifiedClaimRes.status, 403, 'Unverified claimant must be blocked with 403 Forbidden');
  assert.ok(unverifiedClaimRes.data.error.message.includes('Open the payment link we sent you'));

  // Verified claim attempt with guest phone
  const validClaimRes = await api(`/v1/public/cab-requests/${tripRef4}/payment-claim?phone=919876543213`, {
    method: 'POST',
    body: { utr: '428192839182' },
  });
  assert.equal(validClaimRes.status, 200, `Valid claim failed: ${JSON.stringify(validClaimRes.data)}`);
  assert.equal(validClaimRes.data.paymentClaim.status, 'PENDING');
  assert.equal(validClaimRes.data.paymentClaim.utr, '428192839182');

  const trip4InDb: any = await CabRequest.findOne({ reference: tripRef4 }).lean();
  assert.equal(trip4InDb.paymentClaim?.status, 'PENDING');
  assert.equal(trip4InDb.paymentClaim?.utr, '428192839182');
  record('MANUAL_UPI_CLAIM_SUBMITTED', 'PASS', 'Unverified claim blocked (403); Verified guest submitted 12-digit UTR 428192839182 with status PENDING');

  // =========================================================================
  // TEST 7: Short / Malformed UTR Format Validation (SCEN-091)
  // =========================================================================
  console.log(`\n--- TEST 7: UTR Format Validation (SCEN-091) ---`);
  // Create Trip 5
  const trip5Res = await api(`/v1/public/guest-links/${guestToken}/cab-requests`, {
    method: 'POST',
    body: {
      clientRequestId: `req_pay_${uniqueId}_5`,
      guestName: 'Kunal Kapoor',
      phone: '919876543214',
      pickup: 'Mirik',
      destinations: ['NJP'],
      date: Date.now() + 86400000,
      time: '04:00 PM',
      passengers: 4,
      vehicleType: 'SUV',
    },
  });
  assert.equal(trip5Res.status, 201);
  const tripRef5 = trip5Res.data.reference;

  await CabRequest.updateOne(
    { reference: tripRef5 },
    { $set: { status: 'AWAITING_ADVANCE_PAYMENT', advanceAmount: 500, advancePaid: false } }
  );

  // Submit short 4-digit UTR
  const invalidUtrRes = await api(`/v1/public/cab-requests/${tripRef5}/payment-claim?phone=919876543214`, {
    method: 'POST',
    body: { utr: '1234' },
  });
  assert.equal(invalidUtrRes.status, 400, 'Invalid UTR must return 400 Bad Request');
  assert.ok(invalidUtrRes.data.error.message.includes('12-digit UPI reference (UTR)'));
  record('SHORT_UTR_REJECTED', 'PASS', 'Validation rejected short 4-digit UTR "1234" with 400 Bad Request');

  // =========================================================================
  // TEST 8: Duplicate UTR Detection & Fraud Prevention (SCEN-090)
  // =========================================================================
  console.log(`\n--- TEST 8: Duplicate UTR Fraud Prevention (SCEN-090) ---`);
  // Attempt to claim UTR '428192839182' on Trip 5 (already pending on Trip 4)
  const duplicateUtrRes = await api(`/v1/public/cab-requests/${tripRef5}/payment-claim?phone=919876543214`, {
    method: 'POST',
    body: { utr: '428192839182' },
  });
  assert.equal(duplicateUtrRes.status, 409, 'Duplicate UTR must return 409 Conflict');
  assert.ok(duplicateUtrRes.data.error.message.includes('already used for another payment'));
  record('DUPLICATE_UTR_PREVENTION', 'PASS', 'Fraud defense blocked duplicate UTR "428192839182" with 409 Conflict');

  // =========================================================================
  // TEST 9: Admin Rejects Fraudulent Payment Claim (SCEN-089)
  // =========================================================================
  console.log(`\n--- TEST 9: Admin Rejects Fraudulent Claim (SCEN-089) ---`);
  const trip4MongoDoc: any = await CabRequest.findOne({ reference: tripRef4 }).lean();
  const rejectClaimRes = await api(`/v1/admin/cab-requests/${trip4MongoDoc._id}/reject-claim`, {
    method: 'POST',
    token: adminToken,
    body: { reason: 'Bank statement shows no credit for this UTR.' },
  });
  assert.equal(rejectClaimRes.status, 200, `Admin reject claim failed: ${JSON.stringify(rejectClaimRes.data)}`);

  const trip4AfterReject: any = await CabRequest.findOne({ reference: tripRef4 }).lean();
  assert.equal(trip4AfterReject.paymentClaim?.status, 'REJECTED');
  assert.equal(trip4AfterReject.paymentClaim?.reason, 'Bank statement shows no credit for this UTR.');
  assert.equal(trip4AfterReject.advancePaid, false);
  assert.equal(trip4AfterReject.status, 'AWAITING_ADVANCE_PAYMENT');
  record('ADMIN_REJECT_CLAIM', 'PASS', 'Admin rejected fraudulent claim: status=REJECTED, reason stamped, booking kept in payment window');

  // =========================================================================
  // TEST 10: Guest Re-Submission After Rejection (SCEN-093)
  // =========================================================================
  console.log(`\n--- TEST 10: Guest Re-Submission After Rejection (SCEN-093) ---`);
  // Guest corrects mistyped UTR to valid unique 12-digit UTR '559988776655'
  const resubmitClaimRes = await api(`/v1/public/cab-requests/${tripRef4}/payment-claim?phone=919876543213`, {
    method: 'POST',
    body: { utr: '559988776655' },
  });
  assert.equal(resubmitClaimRes.status, 200);
  assert.equal(resubmitClaimRes.data.paymentClaim.status, 'PENDING');
  assert.equal(resubmitClaimRes.data.paymentClaim.utr, '559988776655');

  const trip4AfterResubmit: any = await CabRequest.findOne({ reference: tripRef4 }).lean();
  assert.equal(trip4AfterResubmit.paymentClaim?.status, 'PENDING');
  assert.equal(trip4AfterResubmit.paymentClaim?.utr, '559988776655');
  assert.equal(trip4AfterResubmit.paymentClaim?.reason, '');
  record('GUEST_RESUBMISSION', 'PASS', 'Guest resubmitted corrected UTR 559988776655; status revived to PENDING with cleared reason');

  // =========================================================================
  // TEST 11: Admin Approves Valid UPI Claim (SCEN-088, SCEN-094, SCEN-096)
  // =========================================================================
  console.log(`\n--- TEST 11: Admin Approves Valid UPI Payment (SCEN-088, SCEN-094, SCEN-096) ---`);
  const recordPaymentRes = await api(`/v1/admin/cab-requests/${trip4MongoDoc._id}/record-payment`, {
    method: 'POST',
    token: adminToken,
    body: {
      transactionId: '559988776655',
      method: 'UPI',
      amount: 500,
      notes: 'Verified against HDFC Current A/c Statement',
    },
  });
  assert.equal(recordPaymentRes.status, 200, `Record payment failed: ${JSON.stringify(recordPaymentRes.data)}`);

  const trip4AfterPayment: any = await CabRequest.findOne({ reference: tripRef4 }).lean();
  assert.equal(trip4AfterPayment.status, 'CONFIRMED');
  assert.equal(trip4AfterPayment.advancePaid, true);
  assert.equal(trip4AfterPayment.advancePaymentId, '559988776655');
  assert.equal(trip4AfterPayment.advancePaymentMethod, 'UPI');
  assert.ok(trip4AfterPayment.pickupOtp && trip4AfterPayment.pickupOtp.length === 4, 'Pickup PIN must be issued');

  // Verify guest status page now displays confirmed driver details and PIN
  const guestStatusRes = await api(`/v1/public/cab-requests/${tripRef4}?phone=919876543213`);
  assert.equal(guestStatusRes.status, 200);
  assert.equal(guestStatusRes.data.status, 'CONFIRMED');
  assert.equal(guestStatusRes.data.pickupOtp, trip4AfterPayment.pickupOtp);

  record('ADMIN_APPROVE_PAYMENT', 'PASS', `UPI Payment recorded: Trip ${tripRef4} CONFIRMED, advancePaid=true, PIN=${trip4AfterPayment.pickupOtp} released to guest`);

  // =========================================================================
  // TEST 12: Admin Voids Accidental Payment (SCEN-095)
  // =========================================================================
  console.log(`\n--- TEST 12: Admin Payment Voiding Action (SCEN-095) ---`);
  const voidPaymentRes = await api(`/v1/admin/cab-requests/${trip4MongoDoc._id}/void-payment`, {
    method: 'POST',
    token: adminToken,
    body: { reason: 'Bank chargeback: UPI transaction revoked by remitter' },
  });
  assert.equal(voidPaymentRes.status, 200, `Void payment failed: ${JSON.stringify(voidPaymentRes.data)}`);

  const trip4AfterVoid: any = await CabRequest.findOne({ reference: tripRef4 }).lean();
  assert.equal(trip4AfterVoid.status, 'AWAITING_ADVANCE_PAYMENT', 'Status must revert to AWAITING_ADVANCE_PAYMENT');
  assert.equal(trip4AfterVoid.advancePaid, false, 'advancePaid must revert to false');
  assert.equal(trip4AfterVoid.advancePaymentId, '', 'advancePaymentId must be cleared');
  assert.equal(trip4AfterVoid.voidedPayments?.length, 1, 'Transaction must be archived in voidedPayments');
  assert.equal(trip4AfterVoid.voidedPayments[0].transactionId, '559988776655');
  assert.equal(trip4AfterVoid.voidedPayments[0].reason, 'Bank chargeback: UPI transaction revoked by remitter');
  record('ADMIN_VOID_PAYMENT', 'PASS', 'Admin voided payment: status reverted to AWAITING_ADVANCE_PAYMENT, record archived in voidedPayments');

  // =========================================================================
  // TEST 13: WhatsApp Anti-Spam Containment Final Check
  // =========================================================================
  console.log(`\n--- TEST 13: WhatsApp Interceptor Containment Verification ---`);
  console.log(`📱 Total Outbound WhatsApp Dispatches Intercepted: ${capturedOutboundWhatsApp.length}`);
  assert.ok(capturedOutboundWhatsApp.length > 0, 'WhatsApp alerts should have fired and been intercepted');
  record('WHATSAPP_CONTAINMENT_VERIFIED', 'PASS', `${capturedOutboundWhatsApp.length} notifications safely intercepted with 0 external bytes dispatched`);

  // =========================================================================
  // CLEANUP: Clean test records tagged with QA_TAG
  // =========================================================================
  console.log(`\n--- CLEANUP: Removing Test Run Records ---`);
  await CabRequest.deleteMany({ reference: { $in: [tripRef1, tripRef2, tripRef3, tripRef4, tripRef5] } });
  await User.deleteMany({ email: { $in: [hostEmail, driverEmail] } });
  await getGuestLinkModel(false).deleteMany({ tenantKey: hostEmail });
  record('CLEANUP_COMPLETED', 'PASS', 'Cleaned up temporary QA payment records from MongoDB');

} catch (err: any) {
  console.error('\n❌ FATAL TEST FAILURE:', err);
  manifest.push({ step: 'TEST_EXECUTION', status: 'FAIL', details: err?.message || String(err) });
  process.exitCode = 1;
} finally {
  server.close();
  await mongoose.disconnect();
}

console.log('\n=========================================================================');
console.log('🏆 PAYMENT GATEWAY & MANUAL UPI CLAIMS TEST MANIFEST');
console.log('=========================================================================');
manifest.forEach((m) => console.log(`${m.status === 'PASS' ? '✅' : '❌'} [${m.step}]: ${m.details}`));
const passCount = manifest.filter((m) => m.status === 'PASS').length;
const failCount = manifest.filter((m) => m.status === 'FAIL').length;
console.log(`\nTOTAL PASSED: ${passCount} / ${manifest.length} | FAILED: ${failCount}`);
if (failCount === 0) {
  console.log('🎉 ALL PAYMENT GATEWAY & MANUAL UPI TESTS PASSED PERFECTLY!\n');
} else {
  console.log('💥 SOME ASSERTIONS FAILED. INVESTIGATE LOGS ABOVE.\n');
}
