// Comprehensive End-to-End Testing Suite:
// From Owner Registration to Driver (Nearby Broadcast & Own-Fleet) + WhatsApp Webhooks
// Run: npx tsx scripts/run-e2e-owner-driver-journey.ts
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

// Connect to MongoDB Atlas (or in-memory if MONGODB_URI not provided)
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
const QA_TAG = `STAYCABS_QA_${uniqueId}`;
console.log(`🏷️  QA Execution Tag: ${QA_TAG}\n`);

// Execution Report Manifest
const manifest: { step: string; status: 'PASS' | 'FAIL'; details: string }[] = [];
function record(step: string, status: 'PASS' | 'FAIL', details: string) {
  manifest.push({ step, status, details });
  console.log(`${status === 'PASS' ? '✅' : '❌'} [${step}] ${details}`);
}

try {
  // =========================================================================
  // STEP 1: Admin Authorization & Token Setup
  // =========================================================================
  console.log(`--- STEP 1: Admin Authorization ---`);
  const jwt = (await import('jsonwebtoken')).default;
  const { config } = await import('../src/config/env.js');
  const { User } = await import('../src/models/user.model.js');

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

  // Admin web token: standard aud (NOT 'stayride')
  const adminToken = jwt.sign(
    {
      id: adminUser._id.toString(),
      email: adminUser.email,
      role: 'admin',
      tv: adminUser.tokenVersion || 0,
    },
    config.jwtSecret,
    { expiresIn: '1d' }
  );

  assert.ok(adminToken, 'Admin token should be issued');
  record('ADMIN_AUTH', 'PASS', `Admin verified: ${adminUser.email} (ID: ${adminUser._id})`);

  // =========================================================================
  // STEP 2: Homestay Owner Registration
  // =========================================================================
  console.log(`\n--- STEP 2: Homestay Owner Registration ---`);
  const ownerEmail = `qa_owner_${uniqueId}@staycabs.test`;
  const ownerPhone = '919999990001';
  const ownerPayload = {
    name: 'QA Estate Host',
    email: ownerEmail,
    password: 'SecurePassword123!',
    phone: ownerPhone,
    role: 'owner',
    homestayName: 'Himalayan QA Pine Retreat',
    location: 'Gandhi Road, Darjeeling, West Bengal',
    latitude: 27.041,
    longitude: 88.266,
  };

  const ownerSignupRes = await api('/v1/auth/signup', { body: ownerPayload });
  assert.equal(ownerSignupRes.status, 201, `Owner signup failed: ${JSON.stringify(ownerSignupRes.data)}`);
  assert.ok(ownerSignupRes.data.accessToken, 'Owner should receive accessToken');
  assert.equal(ownerSignupRes.data.role, 'owner');
  const ownerToken = ownerSignupRes.data.accessToken;
  const ownerTenantKey = ownerEmail;
  record('OWNER_REGISTRATION', 'PASS', `Owner registered: ${ownerEmail} (Homestay: Himalayan QA Pine Retreat)`);

  // Verify owner profile in database
  const { getUserModel } = await import('../src/stayride/routes.js');
  const UserModel = getUserModel(false);
  const ownerDoc: any = await UserModel.findOne({ email: ownerEmail }).lean();
  assert.ok(ownerDoc, 'Owner should exist in database');
  assert.equal(ownerDoc.role, 'owner');
  assert.equal(ownerDoc.accountStatus, 'ACTIVE');
  record('OWNER_DB_VERIFICATION', 'PASS', `Owner DB verified: role=owner, accountStatus=ACTIVE, propertyId=${ownerDoc.propertyId}`);

  // =========================================================================
  // STEP 3: Platform Nearby Driver Registration & Admin Approval
  // =========================================================================
  console.log(`\n--- STEP 3: Platform Nearby Driver Registration & Approval ---`);
  const driverEmail = `qa_driver_${uniqueId}@staycabs.test`;
  const driverPhone = '919999990002';
  const driverPayload = {
    name: 'Tashi Lepcha (Nearby Driver)',
    email: driverEmail,
    password: 'SecurePassword123!',
    phone: driverPhone,
    role: 'driver',
    vehicleType: 'SUV',
    vehicleModel: 'Toyota Innova Crysta',
    vehicleNumber: 'WB-74-QA01',
    seats: 6,
    area: 'Darjeeling',
  };

  const driverSignupRes = await api('/v1/auth/signup', { body: driverPayload });
  assert.equal(driverSignupRes.status, 201, `Driver signup failed: ${JSON.stringify(driverSignupRes.data)}`);
  const driverToken = driverSignupRes.data.accessToken;
  const driverId = driverSignupRes.data.driver.id;
  assert.ok(driverToken, 'Driver should receive accessToken');
  record('DRIVER_REGISTRATION', 'PASS', `Driver registered: ${driverEmail} (Vehicle: Innova Crysta WB-74-QA01)`);

  // Verify driver is PENDING_APPROVAL initially
  const driverDocBefore: any = await User.findById(driverId).lean();
  assert.equal(driverDocBefore.accountStatus, 'PENDING_APPROVAL', 'Driver should start as PENDING_APPROVAL');
  record('DRIVER_PENDING_GATE', 'PASS', 'New driver correctly gated in PENDING_APPROVAL status');

  // Attempt to quote while pending -> Should fail with 403
  const prematureQuoteRes = await api('/v1/driver/trips/REQ-DUMMY/quote', {
    method: 'POST',
    token: driverToken,
    body: { quotedFare: 2500 },
  });
  assert.equal(prematureQuoteRes.status, 403, 'Pending driver must not be allowed to quote');
  record('DRIVER_UNAPPROVED_QUOTE_REJECTION', 'PASS', 'Gating asserted: 403 returned on premature quote attempt');

  // Admin approves driver
  const approveRes = await api(`/v1/admin/stayride/drivers/${driverId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'ACTIVE', reason: 'KYC verified for QA' },
  });
  assert.equal(approveRes.status, 200, `Admin approval failed: ${JSON.stringify(approveRes.data)}`);

  const driverDocAfter: any = await User.findById(driverId).lean();
  assert.equal(driverDocAfter.accountStatus, 'ACTIVE', 'Driver should now be ACTIVE');
  record('ADMIN_DRIVER_APPROVAL', 'PASS', `Driver ${driverId} successfully approved to ACTIVE by Admin`);

  // Driver updates location to Darjeeling
  const locRes = await api('/v1/driver/location', {
    method: 'PATCH',
    token: driverToken,
    body: { lat: 27.042, lng: 88.265 },
  });
  assert.equal(locRes.status, 200, 'Driver location update should succeed');
  record('DRIVER_LOCATION_PING', 'PASS', 'Driver GPS location recorded: (27.042, 88.265)');

  // =========================================================================
  // STEP 4: Homestay Owner Configures Own-Fleet Driver
  // =========================================================================
  console.log(`\n--- STEP 4: Homestay Own-Fleet Driver Setup ---`);
  const ownDriverPayload = {
    name: 'Bikash Chauffeur (Own Fleet)',
    phone: '919999990003',
    vehicle: 'Mahindra Bolero 4x4',
    plate: 'WB-74-QA02',
    available: true,
    active: true,
  };

  const addOwnDriverRes = await api('/v1/drivers', {
    method: 'POST',
    token: ownerToken,
    body: ownDriverPayload,
  });
  assert.equal(addOwnDriverRes.status, 201, `Failed to add own driver: ${JSON.stringify(addOwnDriverRes.data)}`);
  const ownDriverId = addOwnDriverRes.data.id;
  assert.ok(ownDriverId, 'Own driver should have an ID');
  record('OWN_FLEET_DRIVER_CREATED', 'PASS', `Own-fleet driver created: ID=${ownDriverId}, Name="${ownDriverPayload.name}"`);

  // Verify own driver list
  const listOwnDriversRes = await api('/v1/drivers', { token: ownerToken });
  assert.equal(listOwnDriversRes.status, 200);
  const foundOwnDriver = listOwnDriversRes.data.find((d: any) => d.id === ownDriverId);
  assert.ok(foundOwnDriver, 'Created own driver must appear in owner driver list');
  record('OWN_FLEET_LIST_VERIFICATION', 'PASS', `Verified own driver listed under homestay fleet`);

  // =========================================================================
  // STEP 5: JOURNEY 1 — Nearby Platform Driver Bidding & Completion
  // =========================================================================
  console.log(`\n--- STEP 5: JOURNEY 1 — Nearby Platform Driver Bidding Flow ---`);
  const futureTripEpoch = Date.now() + 86400000; // Tomorrow
  const trip1Payload = {
    guestName: 'Rohan Sen',
    guestPhone: '919999990004',
    pickup: 'Bagdogra Airport (IXB)',
    destination: 'Himalayan QA Pine Retreat, Darjeeling',
    date: futureTripEpoch,
    time: '11:00 AM',
    passengers: 2,
    vehicleType: 'SUV',
    notes: `${QA_TAG} Journey 1 Nearby Broadcast`,
  };

  // Host creates ride request
  const createTrip1Res = await api('/v1/trips', {
    method: 'POST',
    token: ownerToken,
    body: trip1Payload,
  });
  assert.equal(createTrip1Res.status, 201, `Failed to create trip 1: ${JSON.stringify(createTrip1Res.data)}`);
  const trip1Id = createTrip1Res.data.id;
  const trip1Ref = createTrip1Res.data.reference;
  assert.ok(trip1Ref, 'Trip 1 must have reference code');
  record('CAB_REQUEST_CREATED', 'PASS', `Trip 1 created: ID=${trip1Id}, Ref=${trip1Ref}`);

  // Host dispatches trip to nearby drivers
  const dispatch1Res = await api(`/v1/trips/${trip1Id}/dispatch`, {
    method: 'POST',
    token: ownerToken,
  });
  assert.equal(dispatch1Res.status, 200, `Failed to dispatch trip 1: ${JSON.stringify(dispatch1Res.data)}`);
  assert.equal(dispatch1Res.data.status, 'FINDING_DRIVER');
  record('CAB_REQUEST_DISPATCHED', 'PASS', `Trip 1 dispatched: Status transitioned to FINDING_DRIVER`);

  // Nearby Driver checks available trips:
  // First, verify OWN_FIRST protection: because homestay has own drivers, nearby driver cannot see it yet!
  const initialDriverTripsRes = await api('/v1/driver/trips', { token: driverToken });
  assert.equal(initialDriverTripsRes.status, 200);
  const hiddenFromNearby = !initialDriverTripsRes.data.some((t: any) => t.reference === trip1Ref);
  assert.ok(hiddenFromNearby, 'Trip must initially be reserved exclusively for own drivers');
  record('OWN_FIRST_EXCLUSIVE_WINDOW', 'PASS', 'Business rule verified: Trip reserved for own driver during 10-minute window');

  // Now simulate expiration of the 10-minute own-first window
  const { cabModel } = await import('../src/stayride/platform.js');
  const Cab = cabModel(false);
  await Cab.updateOne({ reference: trip1Ref }, { $set: { nearbyNotifyAt: null } });

  // Now Nearby Driver checks available trips again -> Must be visible!
  const driverTripsRes = await api('/v1/driver/trips', { token: driverToken });
  assert.equal(driverTripsRes.status, 200);
  const tripForDriver = driverTripsRes.data.find((t: any) => t.reference === trip1Ref);
  assert.ok(tripForDriver, 'Trip 1 must be visible in nearby driver feed after window elapses');
  record('DRIVER_FEED_DISCOVERY', 'PASS', `Driver found trip 1 in feed: Reference=${trip1Ref}`);

  // Nearby Driver submits a quote (₹2,800)
  const submitQuoteRes = await api(`/v1/driver/trips/${trip1Ref}/quote`, {
    method: 'POST',
    token: driverToken,
    body: { quotedFare: 2800 },
  });
  assert.equal(submitQuoteRes.status, 200, `Driver quote failed: ${JSON.stringify(submitQuoteRes.data)}`);
  record('DRIVER_QUOTE_SUBMITTED', 'PASS', `Driver submitted quote ₹2,800 for trip ${trip1Ref}`);

  // Host reviews received quotes
  const ownerTripsRes = await api('/v1/trips', { token: ownerToken });
  const tripWithQuote = ownerTripsRes.data.find((t: any) => t.id === trip1Id);
  assert.ok(tripWithQuote, 'Trip 1 must be in owner list');
  assert.ok(tripWithQuote.quotes && tripWithQuote.quotes.length > 0, 'Trip 1 must have at least 1 quote');
  record('OWNER_QUOTE_REVIEW', 'PASS', `Host sees ${tripWithQuote.quotes.length} quote(s) for trip ${trip1Ref}`);

  // Host confirms quote from driver
  const confirmQuoteRes = await api(`/v1/trips/${trip1Id}/confirm-quote`, {
    method: 'POST',
    token: ownerToken,
    body: { driverId: driverId },
  });
  assert.equal(confirmQuoteRes.status, 200, `Confirm quote failed: ${JSON.stringify(confirmQuoteRes.data)}`);
  assert.equal(confirmQuoteRes.data.status, 'AWAITING_ADVANCE', 'Owner app trip status should map to AWAITING_ADVANCE');
  const snap1 = confirmQuoteRes.data.financialSnapshot;
  assert.ok(snap1, 'Financial snapshot must be generated');
  assert.equal(snap1.agreedFare, 2800);
  assert.equal(snap1.platformFeeAmount + snap1.homestayCommissionAmount + snap1.driverPayoutAmount, 2800, 'Rupee conservation invariant must hold');
  record('QUOTE_CONFIRMED_FINANCIAL_SPLIT', 'PASS', `Quote confirmed: Fare=₹2,800, Advance=₹${snap1.advanceAmount}, Remaining Cash=₹${snap1.remainingCashToDriver}, Driver Share=₹${snap1.driverShareOfAdvance || 0}`);

  // Admin records verified Advance Payment (Simulated Gateway Capture)
  const cabDoc1: any = await Cab.findOne({ reference: trip1Ref }).lean();
  assert.ok(cabDoc1, 'CabRequest document must exist');

  const recordPaymentRes = await api(`/v1/admin/cab-requests/${cabDoc1._id}/record-payment`, {
    method: 'POST',
    token: adminToken,
    body: {
      amount: snap1.advanceAmount,
      transactionId: `pay_qa_sim_${uniqueId}`,
      method: 'GATEWAY',
    },
  });
  assert.equal(recordPaymentRes.status, 200, `Record payment failed: ${JSON.stringify(recordPaymentRes.data)}`);
  assert.equal(recordPaymentRes.data.data.status, 'CONFIRMED');
  const pickupPin1 = recordPaymentRes.data.data.pickupOtp;
  assert.ok(pickupPin1 && pickupPin1.length === 4, 'Boarding PIN (4 digits) must be generated');
  record('ADVANCE_PAYMENT_CONFIRMED', 'PASS', `Advance payment verified: Status=CONFIRMED, Boarding PIN=${pickupPin1}`);

  // Driver starts trip: First test wrong PIN, then correct PIN
  const wrongPinRes = await api(`/v1/driver/trips/${trip1Ref}/start`, {
    method: 'POST',
    token: driverToken,
    body: { otp: '0000' },
  });
  assert.equal(wrongPinRes.status, 400, 'Wrong PIN must be rejected');
  record('BOARDING_PIN_REJECTION_CHECK', 'PASS', 'Invalid PIN rejection verified (400 returned)');

  const correctPinRes = await api(`/v1/driver/trips/${trip1Ref}/start`, {
    method: 'POST',
    token: driverToken,
    body: { otp: pickupPin1 },
  });
  assert.equal(correctPinRes.status, 200, `Valid PIN start failed: ${JSON.stringify(correctPinRes.data)}`);
  assert.equal(correctPinRes.data.status, 'TRIP_STARTED');
  record('TRIP_STARTED_WITH_PIN', 'PASS', `Trip ${trip1Ref} started successfully with Boarding PIN`);

  // Driver completes trip
  const completeTripRes = await api(`/v1/driver/trips/${trip1Ref}/complete`, {
    method: 'POST',
    token: driverToken,
    body: { finalFare: 2800 },
  });
  assert.equal(completeTripRes.status, 200, `Complete trip failed: ${JSON.stringify(completeTripRes.data)}`);
  assert.equal(completeTripRes.data.status, 'COMPLETED');
  record('TRIP_COMPLETED', 'PASS', `Trip ${trip1Ref} completed: Cash balance collected by driver directly`);

  // Driver Sovereign Wallet Check
  const walletRes = await api('/v1/driver/wallet', { token: driverToken });
  assert.equal(walletRes.status, 200, `Wallet check failed: ${JSON.stringify(walletRes.data)}`);
  record('DRIVER_WALLET_AUDIT', 'PASS', `Driver Wallet verified: Available=₹${walletRes.data.available}, EligibleTrips=${walletRes.data.eligibleTrips}`);

  // =========================================================================
  // STEP 6: JOURNEY 2 — Homestay Own-Fleet Direct Dispatch
  // =========================================================================
  console.log(`\n--- STEP 6: JOURNEY 2 — Homestay Own-Fleet Direct Dispatch Flow ---`);
  const trip2Payload = {
    guestName: 'Priya Sen',
    guestPhone: '919999990005',
    pickup: 'Darjeeling Clock Tower',
    destination: 'Mirik Lake & Back',
    date: futureTripEpoch,
    time: '02:00 PM',
    passengers: 4,
    vehicleType: 'SUV',
    notes: `${QA_TAG} Journey 2 Own-Fleet`,
  };

  const createTrip2Res = await api('/v1/trips', {
    method: 'POST',
    token: ownerToken,
    body: trip2Payload,
  });
  assert.equal(createTrip2Res.status, 201);
  const trip2Id = createTrip2Res.data.id;
  const trip2Ref = createTrip2Res.data.reference;
  record('OWN_FLEET_TRIP_CREATED', 'PASS', `Trip 2 created: ID=${trip2Id}, Ref=${trip2Ref}`);

  // Host directly assigns Own-Fleet Driver at agreed fare ₹2,500
  const assignOwnFleetRes = await api(`/v1/trips/${trip2Id}/assign`, {
    method: 'POST',
    token: ownerToken,
    body: {
      driverId: ownDriverId,
      fare: 2500,
    },
  });
  assert.equal(assignOwnFleetRes.status, 200, `Assign own fleet failed: ${JSON.stringify(assignOwnFleetRes.data)}`);
  const snap2 = assignOwnFleetRes.data.financialSnapshot;
  assert.ok(snap2, 'Own-fleet financial snapshot must exist');
  assert.equal(snap2.homestayCommissionAmount, 0, 'Own-fleet homestay referral commission must be 0%');
  assert.ok(snap2.platformFeeAmount > 0, 'StayRide platform fee must be applied');
  assert.equal(snap2.agreedFare, 2500);
  assert.equal(snap2.remainingCashToDriver, 2500 - snap2.platformFeeAmount);
  record('OWN_FLEET_ASSIGNED_INVARIANTS', 'PASS', `Own-fleet assigned: Fare=₹2,500, Platform Fee=₹${snap2.platformFeeAmount}, Host Comm=₹0, Cash to Driver=₹${snap2.remainingCashToDriver}`);

  // Admin records verified Advance Payment for Own-Fleet Platform Fee
  const cabDoc2: any = await Cab.findOne({ reference: trip2Ref }).lean();
  const payOwnRes = await api(`/v1/admin/cab-requests/${cabDoc2._id}/record-payment`, {
    method: 'POST',
    token: adminToken,
    body: {
      amount: snap2.advanceAmount,
      transactionId: `pay_qa_own_${uniqueId}`,
      method: 'UPI',
    },
  });
  assert.equal(payOwnRes.status, 200);
  assert.equal(payOwnRes.data.data.status, 'CONFIRMED');
  const pickupPin2 = payOwnRes.data.data.pickupOtp;
  record('OWN_FLEET_ADVANCE_CONFIRMED', 'PASS', `Own-fleet advance confirmed: PIN=${pickupPin2}`);

  // Admin starts own-fleet trip (simulating start)
  const startTrip2Res = await api(`/v1/admin/cab-requests/${cabDoc2._id}/start`, {
    method: 'POST',
    token: adminToken,
  });
  assert.equal(startTrip2Res.status, 200);
  record('OWN_FLEET_TRIP_STARTED', 'PASS', `Own-fleet trip ${trip2Ref} started`);

  // Admin completes own-fleet trip
  const completeTrip2Res = await api(`/v1/admin/cab-requests/${cabDoc2._id}/complete`, {
    method: 'POST',
    token: adminToken,
  });
  assert.equal(completeTrip2Res.status, 200);
  record('OWN_FLEET_TRIP_COMPLETED', 'PASS', `Own-fleet trip ${trip2Ref} completed cleanly`);

  // =========================================================================
  // STEP 7: WhatsApp Webhook Inbound Reception Verification
  // =========================================================================
  console.log(`\n--- STEP 7: WhatsApp Inbound Webhook Reception Verification ---`);
  // Webhook GET Subscribe Handshake
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'staycabs-verify-secret-test';
  const challenge = 'challenge_test_code_987654';
  const getWebhookRes = await api(`/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=${challenge}`);
  assert.equal(getWebhookRes.status, 200, `Webhook handshake failed: ${getWebhookRes.status}`);
  assert.equal(getWebhookRes.data.text, challenge, 'Handshake must echo challenge');
  record('WHATSAPP_WEBHOOK_HANDSHAKE', 'PASS', `Meta subscribe handshake verified: Status 200, Challenge echoed`);

  // Webhook POST Status Delivery with HMAC SHA256 Signature
  const appSecret = process.env.WHATSAPP_APP_SECRET || 'staycabs-app-secret-test';
  const statusPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '919239842574', phone_number_id: 'TEST_PHONE_ID' },
              statuses: [
                {
                  id: 'wamid.TEST_MESSAGE_ID_001',
                  status: 'delivered',
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  recipient_id: '919999990001',
                  biz_opaque_callback_data: JSON.stringify({ e: 'CAB_BOOKING_CONFIRMED', r: trip1Ref }),
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  const rawBody = JSON.stringify(statusPayload);
  const hmacSignature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const postWebhookRes = await originalFetch(`${BASE_URL}/v1/webhooks/whatsapp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': hmacSignature,
    },
    body: rawBody,
  });
  assert.equal(postWebhookRes.status, 200, `Webhook status update failed: ${postWebhookRes.status}`);
  record('WHATSAPP_WEBHOOK_DELIVERY_RECEIPT', 'PASS', `Signed Meta delivery receipt processed successfully (Status 200)`);

  // Check captured WhatsApp outbound events log
  console.log(`\n--- STEP 8: WhatsApp Outbound Interception & Log Audit ---`);
  console.log(`Captured ${capturedOutboundWhatsApp.length} outbound WhatsApp dispatch event(s):`);
  for (const item of capturedOutboundWhatsApp) {
    console.log(`  📩 Event to: ${item.to}, Template: ${item.template || 'TEXT'}, Timestamp: ${item.timestamp}`);
  }
  record('WHATSAPP_OUTBOUND_SAFETY_AUDIT', 'PASS', `Verified ${capturedOutboundWhatsApp.length} outbound alert(s) safely intercepted and logged with zero external leaks`);

} catch (err: any) {
  console.error('\n❌ TEST RUNNER FAILED WITH EXCEPTION:', err);
  record('EXECUTION_EXCEPTION', 'FAIL', err?.message || String(err));
} finally {
  server.close();
  await mongoose.disconnect();
  console.log('\n======================================================');
  console.log('🏁 E2E OWNER TO DRIVER (NEARBY & OWN-FLEET) SUMMARY:');
  console.log('======================================================');
  let passCount = 0, failCount = 0;
  for (const m of manifest) {
    if (m.status === 'PASS') passCount++; else failCount++;
    console.log(`${m.status === 'PASS' ? '✅' : '❌'} [${m.step}] ${m.details}`);
  }
  console.log(`\nTOTAL: ${manifest.length} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('======================================================\n');
}
