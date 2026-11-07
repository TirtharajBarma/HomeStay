// Comprehensive Guest Journey & Multi-Driver Competitive Bidding Test Suite
// Covers: Guest Web Link Submission, Real-Time Driver Quotes, Anti-Gouging & Contact Leakage Defense,
// Multi-Driver Bidding Wars, Dynamic Price Revisions, Host Counter-Offers, Outbid States,
// Bidding Timeout, Fallback Triggers, Tie-Breakers, and Clean State Machine Transitions.
// Run: npx tsx scripts/run-e2e-guest-multidriver-bidding.ts

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

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

// Clear localhost rate limits for clean test run
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
const QA_TAG = `STAYCABS_QA_BID_${uniqueId}`;
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
  const { Property } = await import('../src/models/property.model.js');
  const { CommissionService } = await import('../src/services/commission.service.js');
  const platform = await import('../src/stayride/platform.js');

  // =========================================================================
  // SETUP: Admin, Homestay Owner, and 3 Distinct Verified Drivers
  // =========================================================================
  console.log(`--- STEP 0: Test Environment Entities Setup ---`);

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
  const hostEmail = `qa_host_bid_${uniqueId}@staycabs.test`;
  const hostPhone = `919999${String(uniqueId).slice(-6)}`;
  const hostSignupRes = await api('/v1/auth/signup', {
    body: {
      name: 'QA Mountain Estate Host',
      email: hostEmail,
      password: 'SecurePassword123!',
      phone: hostPhone,
      role: 'owner',
      homestayName: 'Kanchenjunga QA View Homestay',
      location: 'Observatory Hill, Darjeeling, West Bengal',
      latitude: 27.042,
      longitude: 88.267,
    },
  });
  assert.equal(hostSignupRes.status, 201, `Host signup failed: ${JSON.stringify(hostSignupRes.data)}`);
  const hostToken = hostSignupRes.data.accessToken;
  const hostTenantKey = hostEmail;

  // Features: guestCabLinks, platformDispatch, driverQuotes are all defaultOn: true

  // 3. Driver A (Toyota Innova Crysta, SUV, Rating 4.9)
  const driverAEmail = `qa_driver_a_${uniqueId}@staycabs.test`;
  const driverAPhone = `919800${String(uniqueId).slice(-6)}`;
  const driverARes = await api('/v1/auth/signup', {
    body: {
      name: 'Driver Alpha (Innova Crysta)',
      email: driverAEmail,
      password: 'SecurePassword123!',
      phone: driverAPhone,
      role: 'driver',
      vehicleType: 'SUV',
      vehicleModel: 'Toyota Innova Crysta',
      vehicleNumber: 'WB-74-BID01',
      seats: 6,
      area: 'Darjeeling',
    },
  });
  assert.equal(driverARes.status, 201);
  const driverAToken = driverARes.data.accessToken;
  const driverAId = driverARes.data.driver.id;

  // 4. Driver B (Mahindra Bolero, SUV, Rating 4.7)
  const driverBEmail = `qa_driver_b_${uniqueId}@staycabs.test`;
  const driverBPhone = `919801${String(uniqueId).slice(-6)}`;
  const driverBRes = await api('/v1/auth/signup', {
    body: {
      name: 'Driver Bravo (Mahindra Bolero)',
      email: driverBEmail,
      password: 'SecurePassword123!',
      phone: driverBPhone,
      role: 'driver',
      vehicleType: 'SUV',
      vehicleModel: 'Mahindra Bolero 4x4',
      vehicleNumber: 'WB-74-BID02',
      seats: 6,
      area: 'Darjeeling',
    },
  });
  assert.equal(driverBRes.status, 201);
  const driverBToken = driverBRes.data.accessToken;
  const driverBId = driverBRes.data.driver.id;

  // 5. Driver C (Maruti Ertiga, SUV, Rating 4.8)
  const driverCEmail = `qa_driver_c_${uniqueId}@staycabs.test`;
  const driverCPhone = `919802${String(uniqueId).slice(-6)}`;
  const driverCRes = await api('/v1/auth/signup', {
    body: {
      name: 'Driver Charlie (Maruti Ertiga)',
      email: driverCEmail,
      password: 'SecurePassword123!',
      phone: driverCPhone,
      role: 'driver',
      vehicleType: 'SUV',
      vehicleModel: 'Maruti Ertiga ZXi',
      vehicleNumber: 'WB-74-BID03',
      seats: 6,
      area: 'Darjeeling',
    },
  });
  assert.equal(driverCRes.status, 201);
  const driverCToken = driverCRes.data.accessToken;
  const driverCId = driverCRes.data.driver.id;

  // Admin approves all 3 drivers and sets initial ratings
  for (const [id, ratingSum, ratingCount] of [
    [driverAId, 49, 10], // 4.9
    [driverBId, 47, 10], // 4.7
    [driverCId, 48, 10], // 4.8
  ] as [string, number, number][]) {
    await api(`/v1/admin/stayride/drivers/${id}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { status: 'ACTIVE', reason: 'Approved for competitive bidding QA' },
    });
    await User.findByIdAndUpdate(id, { ratingSum, ratingCount });
  }

  // Drivers send GPS location ping to Darjeeling
  for (const token of [driverAToken, driverBToken, driverCToken]) {
    await api('/v1/driver/location', {
      method: 'PATCH',
      token,
      body: { lat: 27.042, lng: 88.266 },
    });
  }

  record('SETUP_ENTITIES', 'PASS', 'Created Host & 3 Approved Drivers: Alpha (4.9), Bravo (4.7), Charlie (4.8)');

  // =========================================================================
  // FLOW 1: Host Generates Guest Link & Guest Submits Cab Request
  // =========================================================================
  console.log(`\n--- FLOW 1: Guest Web Request Submission & Idempotency ---`);
  const guestLinkRes = await api('/v1/guest-links', {
    method: 'POST',
    token: hostToken,
    body: { guestName: 'Dr. Rohan Mehra', guestPhone: '919876543210', roomName: 'Kanchenjunga Suite' },
  });
  assert.equal(guestLinkRes.status, 201, `Failed creating guest link: ${JSON.stringify(guestLinkRes.data)}`);
  const guestUrl = guestLinkRes.data.url;
  assert.ok(guestUrl, 'Guest link URL must be returned');
  const guestToken = new URL(guestUrl).searchParams.get('t') || guestUrl.split('?t=')[1];
  assert.ok(guestToken, 'Guest token must be parsed from URL');

  // Guest submits ride request: Darjeeling Mall to Gangtok MG Marg
  const clientReqId1 = `req_bid_${uniqueId}_1`;
  const guestCabReqPayload = {
    clientRequestId: clientReqId1,
    guestName: 'Dr. Rohan Mehra',
    phone: '919876543210',
    pickup: 'Darjeeling Mall Road',
    destinations: ['Gangtok MG Marg'],
    date: Date.now() + 86400000, // Tomorrow
    time: '09:00 AM',
    passengers: 4,
    vehicleType: 'SUV',
    guestBudget: 3200,
    notes: 'Please send driver with mountain experience and clean AC vehicle.',
  };

  const createTripRes = await api(`/v1/public/guest-links/${guestToken}/cab-requests`, {
    method: 'POST',
    body: guestCabReqPayload,
  });
  assert.equal(createTripRes.status, 201, `Guest cab request failed: ${JSON.stringify(createTripRes.data)}`);
  const tripRef1 = createTripRes.data.reference;
  assert.ok(tripRef1, 'Trip reference must be issued');
  assert.equal(createTripRes.data.status, 'FINDING_DRIVER', 'Trip initial status must be FINDING_DRIVER');

  // Idempotency: Resubmit identical payload with same clientRequestId
  const retryTripRes = await api(`/v1/public/guest-links/${guestToken}/cab-requests`, {
    method: 'POST',
    body: guestCabReqPayload,
  });
  assert.equal(retryTripRes.status, 201, 'Idempotent resubmission must succeed');
  assert.equal(retryTripRes.data.reference, tripRef1, 'Idempotent request must return identical trip reference');

  // Verify MongoDB document state
  const tripDoc1: any = await CabRequest.findOne({ reference: tripRef1 }).lean();
  assert.ok(tripDoc1, 'Trip document must exist in MongoDB');
  assert.equal(tripDoc1.requestSource, 'GUEST_WEB_LINK', 'requestSource must be GUEST_WEB_LINK');
  assert.equal(tripDoc1.guestBudget, 3200, 'Guest budget must be stored');
  assert.equal(tripDoc1.status, 'FINDING_DRIVER', 'Status must be FINDING_DRIVER');
  record('GUEST_REQUEST_CREATED', 'PASS', `Trip ${tripRef1} created with source GUEST_WEB_LINK & budget ₹3,200`);

  // =========================================================================
  // FLOW 2: Zero-Trust Security, Anti-Gouging & Contact Leakage Defense
  // =========================================================================
  console.log(`\n--- FLOW 2: Input Validation, Anti-Gouging & Privacy Defense ---`);

  // Test Priority Dispatch Window: Nearby driver quotes before own-fleet window ends -> 409 Conflict
  await CabRequest.updateOne({ reference: tripRef1 }, { $set: { nearbyNotifyAt: new Date(Date.now() + 600000) } });
  const prematureQuoteRes = await api(`/v1/driver/trips/${tripRef1}/quote`, {
    method: 'POST',
    token: driverAToken,
    body: { quotedFare: 3400 },
  });
  assert.equal(prematureQuoteRes.status, 409, 'Quoting during own-fleet priority window must return 409 Conflict');
  assert.ok(prematureQuoteRes.data.error.message.includes('not open to nearby drivers yet'));
  record('PRIORITY_WINDOW_GATE', 'PASS', 'Nearby driver quote blocked with 409 during own-fleet priority window');

  // Open trip to nearby drivers by clearing nearbyNotifyAt
  await CabRequest.updateOne({ reference: tripRef1 }, { $set: { nearbyNotifyAt: null } });

  // SCEN-040: Negative / Zero Fare Rejection
  const zeroFareRes = await api(`/v1/driver/trips/${tripRef1}/quote`, {
    method: 'POST',
    token: driverAToken,
    body: { quotedFare: 0 },
  });
  assert.equal(zeroFareRes.status, 400, 'Zero fare quote must be rejected with 400 Bad Request');
  record('ZERO_FARE_REJECTION', 'PASS', 'Validation rejected quotedFare = 0 with 400 Bad Request');

  // SCEN-041: Excessive Fare Boundary (Anti-Gouging Defense)
  const gougingFareRes = await api(`/v1/driver/trips/${tripRef1}/quote`, {
    method: 'POST',
    token: driverAToken,
    body: { quotedFare: 80000 },
  });
  assert.equal(gougingFareRes.status, 400, 'Astronomical gouging fare must be rejected with 400 Bad Request');
  assert.ok(
    gougingFareRes.data.error.message.includes('exceeds the maximum permissible limit'),
    'Gouging error message must state limit exceeded'
  );
  record('ANTI_GOUGING_DEFENSE', 'PASS', 'Anti-gouging defense blocked ₹80,000 quote with 400 Bad Request');

  // SCEN-045: Contact Info Leakage in Notes Field
  const contactLeakRes = await api(`/v1/driver/trips/${tripRef1}/quote`, {
    method: 'POST',
    token: driverAToken,
    body: {
      quotedFare: 3400,
      notes: 'Call me directly on 9876543210 for offline discount and direct pickup!',
    },
  });
  assert.equal(contactLeakRes.status, 400, 'Contact info in notes must be rejected with 400 Bad Request');
  assert.ok(
    contactLeakRes.data.error.message.includes('Notes cannot contain phone numbers'),
    'Error message must prohibit contact details'
  );
  record('CONTACT_LEAK_DEFENSE', 'PASS', 'Notes containing phone number rejected with 400 Bad Request');

  // =========================================================================
  // FLOW 3: Multi-Driver Competitive Bidding (SCEN-037, SCEN-038, SCEN-046)
  // =========================================================================
  console.log(`\n--- FLOW 3: Multi-Driver Competitive Bidding ---`);

  // Driver A quotes ₹3,400 (SCEN-037)
  const quoteARes = await api(`/v1/driver/trips/${tripRef1}/quote`, {
    method: 'POST',
    token: driverAToken,
    body: { quotedFare: 3400, notes: 'Premium AC Innova Crysta with luggage rack' },
  });
  assert.equal(quoteARes.status, 200, `Driver A quote failed: ${JSON.stringify(quoteARes.data)}`);
  assert.equal(quoteARes.data.status, 'QUOTE_RECEIVED', 'Trip status must transition to QUOTE_RECEIVED');

  // Driver B quotes ₹3,100 (SCEN-038)
  const quoteBRes = await api(`/v1/driver/trips/${tripRef1}/quote`, {
    method: 'POST',
    token: driverBToken,
    body: { quotedFare: 3100, notes: 'Spacious Bolero 4x4, experienced local mountain driver' },
  });
  assert.equal(quoteBRes.status, 200, `Driver B quote failed: ${JSON.stringify(quoteBRes.data)}`);

  // Driver C quotes ₹2,900 (Lowest initial bid)
  const quoteCRes = await api(`/v1/driver/trips/${tripRef1}/quote`, {
    method: 'POST',
    token: driverCToken,
    body: { quotedFare: 2900, notes: 'Clean Ertiga, smooth drive, music system' },
  });
  assert.equal(quoteCRes.status, 200, `Driver C quote failed: ${JSON.stringify(quoteCRes.data)}`);

  // Atlas DB Verification: 3 pending quotes in array (SCEN-046)
  const tripAfter3Quotes: any = await CabRequest.findOne({ reference: tripRef1 }).lean();
  assert.equal(tripAfter3Quotes.quotes.length, 3, 'Must have exactly 3 quotes in the quotes array');
  assert.equal(tripAfter3Quotes.status, 'QUOTE_RECEIVED', 'Status must remain QUOTE_RECEIVED');
  for (const q of tripAfter3Quotes.quotes) {
    assert.equal(q.status, 'PENDING', 'All initial submitted quotes must be PENDING');
    assert.equal(q.counterFare, null, 'counterFare must start as null');
  }
  record('MULTI_DRIVER_QUOTES', 'PASS', '3 competitive quotes submitted: Driver A (₹3,400), Driver B (₹3,100), Driver C (₹2,900)');

  // =========================================================================
  // FLOW 4: Dynamic Re-Bidding / Price Revision War (SCEN-039)
  // =========================================================================
  console.log(`\n--- FLOW 4: Dynamic Re-Bidding & Price Revision War ---`);

  // Driver A sees they are highest at ₹3,400, revises quote down to ₹2,800
  const reviseARes = await api(`/v1/driver/trips/${tripRef1}/quote`, {
    method: 'POST',
    token: driverAToken,
    body: { quotedFare: 2800, notes: 'Revised special rate: ₹2,800 for Innova Crysta' },
  });
  assert.equal(reviseARes.status, 200, `Driver A revision failed: ${JSON.stringify(reviseARes.data)}`);

  // Driver B also lowers fare to ₹2,750
  const reviseBRes = await api(`/v1/driver/trips/${tripRef1}/quote`, {
    method: 'POST',
    token: driverBToken,
    body: { quotedFare: 2750, notes: 'Discounted mountain fare: ₹2,750 Bolero' },
  });
  assert.equal(reviseBRes.status, 200, `Driver B revision failed: ${JSON.stringify(reviseBRes.data)}`);

  // Atlas DB Verification: Still exactly 3 quotes (no duplicate quote documents created)
  const tripAfterRevisions: any = await CabRequest.findOne({ reference: tripRef1 }).lean();
  assert.equal(tripAfterRevisions.quotes.length, 3, 'Quote revisions must update in place without increasing array length');

  const quoteAInDb = tripAfterRevisions.quotes.find((q: any) => String(q.driverId) === String(driverAId));
  const quoteBInDb = tripAfterRevisions.quotes.find((q: any) => String(q.driverId) === String(driverBId));
  assert.equal(quoteAInDb.quotedFare, 2800, "Driver A's fare must be updated to ₹2,800");
  assert.equal(quoteBInDb.quotedFare, 2750, "Driver B's fare must be updated to ₹2,750");
  assert.equal(quoteAInDb.status, 'PENDING', 'Revised quote status must remain PENDING');
  record('PRICE_REVISION_WAR', 'PASS', 'Quotes revised in place: Driver A -> ₹2,800, Driver B -> ₹2,750. Zero duplicate records!');

  // =========================================================================
  // FLOW 5: Guest vs Host View Separation (Zero Information Leakage)
  // =========================================================================
  console.log(`\n--- FLOW 5: Information Boundary (Guest vs Host Real-Time View) ---`);

  // Guest visits public status page: GET /v1/public/cab-requests/:reference
  const guestViewRes = await api(`/v1/public/cab-requests/${tripRef1}`);
  assert.equal(guestViewRes.status, 200);
  assert.equal(guestViewRes.data.quotesCount, 3, 'Guest view must display total count of pending quotes (3)');
  assert.equal(guestViewRes.data.driverName, '', 'Guest must NOT see driver name before advance payment');
  assert.equal(guestViewRes.data.driverPhone, '', 'Guest must NOT see driver phone before advance payment');
  assert.equal(guestViewRes.data.vehicle, '', 'Guest must NOT see vehicle details before advance payment');

  // Host dashboard inspects trip: GET /v1/trips/:id
  const hostTripsRes = await api('/v1/trips', { token: hostToken });
  assert.equal(hostTripsRes.status, 200);
  const hostTripView = (hostTripsRes.data.trips || hostTripsRes.data).find((t: any) => t.reference === tripRef1);
  assert.ok(hostTripView, 'Trip must appear in host dashboard');
  assert.equal(hostTripView.quotes?.length, 3, 'Host must see all 3 competitive driver quotes');

  record('VIEW_BOUNDARY_VERIFIED', 'PASS', 'Guest view shows quotesCount=3 with zero driver contact leakage; Host sees all 3 offers');

  // =========================================================================
  // FLOW 6: Host Counter-Offer & Driver Acceptance (SCEN-055 to SCEN-064)
  // =========================================================================
  console.log(`\n--- FLOW 6: Host Counter-Offer, Acceptance & Outbid State Transitions ---`);

  // SCEN-058: Host attempts to counter with identical fare -> 400 Bad Request
  const numericTripId1 = hostTripView.id || tripDoc1.tripId;
  const sameFareCounterRes = await api(`/v1/trips/${numericTripId1}/counter`, {
    method: 'POST',
    token: hostToken,
    body: { driverId: driverAId, fare: 2800 },
  });
  assert.equal(sameFareCounterRes.status, 400, 'Countering with driver own quoted fare must fail with 400');
  assert.ok(sameFareCounterRes.data.error.message.includes("That is the driver's own fare"), 'Message must instruct to confirm quote');
  record('COUNTER_SAME_FARE_REJECTED', 'PASS', 'Validation prevented redundant counter-offer equal to quoted fare');

  // SCEN-055: Host counters Driver A at ₹2,600
  const counterRes = await api(`/v1/trips/${numericTripId1}/counter`, {
    method: 'POST',
    token: hostToken,
    body: { driverId: driverAId, fare: 2600 },
  });
  assert.equal(counterRes.status, 200, `Host counter-offer failed: ${JSON.stringify(counterRes.data)}`);

  // Atlas DB verification of counter
  const tripAfterCounter: any = await CabRequest.findOne({ reference: tripRef1 }).lean();
  const quoteACountered = tripAfterCounter.quotes.find((q: any) => String(q.driverId) === String(driverAId));
  assert.equal(quoteACountered.counterFare, 2600, 'Driver A quote counterFare must be ₹2,600');
  assert.ok(quoteACountered.counterAt, 'counterAt timestamp must be recorded');

  // Verify intercepted WhatsApp alert sent to Driver A
  const counterWhatsApp = capturedOutboundWhatsApp.find((w) => w.to === driverAPhone);
  assert.ok(counterWhatsApp, `Driver A must receive WhatsApp notification for counter-offer at ${driverAPhone}`);
  record('HOST_COUNTER_OFFER', 'PASS', 'Host counter-offered Driver A at ₹2,600; WhatsApp counter notification intercepted');

  // SCEN-056: Driver A accepts the counter-offer
  const acceptCounterRes = await api(`/v1/driver/trips/${tripRef1}/accept-counter`, {
    method: 'POST',
    token: driverAToken,
  });
  assert.equal(acceptCounterRes.status, 200, `Driver A counter acceptance failed: ${JSON.stringify(acceptCounterRes.data)}`);

  // Atlas DB Verification: Complete State Transition & Atomic Outbid Updates (SCEN-063, SCEN-064)
  const tripAfterAccept: any = await CabRequest.findOne({ reference: tripRef1 }).lean();
  assert.equal(tripAfterAccept.status, 'AWAITING_ADVANCE_PAYMENT', 'Status must transition to AWAITING_ADVANCE_PAYMENT');
  assert.equal(tripAfterAccept.agreedFare, 2600, 'agreedFare must lock at ₹2,600');
  assert.equal(String(tripAfterAccept.assignedDriverUserId), String(driverAId), 'Driver A must be assigned');
  assert.equal(tripAfterAccept.assignedDriverName, 'Driver Alpha (Innova Crysta)', 'Assigned driver name must be stamped');
  assert.equal(tripAfterAccept.vehicleDetails?.model, 'Toyota Innova Crysta', 'Vehicle model must be stamped');
  assert.equal(tripAfterAccept.vehicleDetails?.plate, 'WB-74-BID01', 'Vehicle plate must be stamped');

  // Assert atomic quotes array updates
  const finalQuoteA = tripAfterAccept.quotes.find((q: any) => String(q.driverId) === String(driverAId));
  const finalQuoteB = tripAfterAccept.quotes.find((q: any) => String(q.driverId) === String(driverBId));
  const finalQuoteC = tripAfterAccept.quotes.find((q: any) => String(q.driverId) === String(driverCId));

  assert.equal(finalQuoteA.status, 'ACCEPTED', "Winning Driver A quote must be 'ACCEPTED'");
  assert.equal(finalQuoteA.quotedFare, 2600, "Winning quote fare must reflect accepted counter of ₹2,600");
  assert.equal(finalQuoteA.counterFare, null, 'counterFare must be reset to null');

  assert.equal(finalQuoteB.status, 'REJECTED', "Losing Driver B quote must transition to 'REJECTED'");
  assert.equal(finalQuoteB.outbid, true, "Losing Driver B quote must have 'outbid: true'");

  assert.equal(finalQuoteC.status, 'REJECTED', "Losing Driver C quote must transition to 'REJECTED'");
  assert.equal(finalQuoteC.outbid, true, "Losing Driver C quote must have 'outbid: true'");

  // SCEN-064: Financial Snapshot Verification
  assert.ok(tripAfterAccept.financialSnapshot, 'financialSnapshot must be generated upon confirmation');
  const snap = tripAfterAccept.financialSnapshot;
  assert.equal(snap.agreedFare, 2600, 'Snapshot agreedFare must be 2600');
  assert.equal(snap.platformFeeAmount, 130, 'platformFeeAmount must be 130');
  assert.equal(snap.homestayCommissionAmount, 130, 'homestayCommissionAmount must be 130');
  assert.equal(snap.driverPayoutAmount, 2340, 'driverPayoutAmount must be 2340');
  assert.equal(
    snap.agreedFare,
    snap.platformFeeAmount + snap.homestayCommissionAmount + snap.driverPayoutAmount,
    'Commission conservation invariant must hold (agreedFare = PF + HC + driverPayout)'
  );
  record('COUNTER_ACCEPTED_OUTBID_VERIFIED', 'PASS', 'Driver A accepted counter: quote ACCEPTED, competing quotes REJECTED with outbid: true, financialSnapshot verified');

  // =========================================================================
  // FLOW 7: Quoting Rejection on Closed / Confirmed Trip (SCEN-042)
  // =========================================================================
  console.log(`\n--- FLOW 7: Late Bidding Gating on Confirmed Trip ---`);
  const lateQuoteRes = await api(`/v1/driver/trips/${tripRef1}/quote`, {
    method: 'POST',
    token: driverCToken,
    body: { quotedFare: 2200 },
  });
  assert.equal(lateQuoteRes.status, 409, 'Quoting on confirmed trip must return 409 Conflict');
  assert.ok(lateQuoteRes.data.error.message.includes('no longer accepting quotes'));
  record('CLOSED_TRIP_QUOTE_REJECTION', 'PASS', 'Late quote on confirmed trip rejected with 409 Conflict');

  // =========================================================================
  // FLOW 8: Trip Cancellation During Bidding & Quote Gating (SCEN-043)
  // =========================================================================
  console.log(`\n--- FLOW 8: Cancellation During Bidding & Post-Cancel Quoting Defense ---`);
  // Create Trip 2
  const trip2Res = await api(`/v1/public/guest-links/${guestToken}/cab-requests`, {
    method: 'POST',
    body: {
      clientRequestId: `req_bid_${uniqueId}_2`,
      guestName: 'Ananya Roy',
      phone: '919876543211',
      pickup: 'Ghum Railway Station',
      destinations: ['Bagdogra Airport'],
      date: Date.now() + 86400000,
      time: '11:00 AM',
      passengers: 2,
      vehicleType: 'SUV',
    },
  });
  assert.equal(trip2Res.status, 201);
  const tripRef2 = trip2Res.data.reference;
  await CabRequest.updateOne({ reference: tripRef2 }, { $set: { nearbyNotifyAt: null } });

  // Driver B quotes on Trip 2
  await api(`/v1/driver/trips/${tripRef2}/quote`, {
    method: 'POST',
    token: driverBToken,
    body: { quotedFare: 2800 },
  });

  // Host cancels Trip 2
  const hostTrips2Res = await api('/v1/trips', { token: hostToken });
  const trip2View = (hostTrips2Res.data.trips || hostTrips2Res.data).find((t: any) => t.reference === tripRef2);
  const numericTripId2 = trip2View.id;

  const cancelRes = await api(`/v1/trips/${numericTripId2}/cancel`, {
    method: 'POST',
    token: hostToken,
    body: { reason: 'Guest cancelled flight' },
  });
  assert.equal(cancelRes.status, 200, `Cancel trip failed: ${JSON.stringify(cancelRes.data)}`);

  const trip2InDb: any = await CabRequest.findOne({ reference: tripRef2 }).lean();
  assert.equal(trip2InDb.status, 'CANCELLED', 'Trip 2 status must be CANCELLED');

  // Driver C attempts to quote on cancelled Trip 2 -> 409 Conflict
  const quoteCancelledRes = await api(`/v1/driver/trips/${tripRef2}/quote`, {
    method: 'POST',
    token: driverCToken,
    body: { quotedFare: 2500 },
  });
  assert.equal(quoteCancelledRes.status, 409, 'Quoting on cancelled trip must fail with 409 Conflict');
  record('CANCELLED_TRIP_QUOTE_DEFENSE', 'PASS', 'Trip cancelled by host during bidding; subsequent quotes rejected with 409 Conflict');

  // =========================================================================
  // FLOW 9: Bidding Fallback Trigger & Single-Alert Idempotency (SCEN-050, SCEN-051)
  // =========================================================================
  console.log(`\n--- FLOW 9: Bidding Fallback Alert & Single-Alert Idempotency ---`);
  // Create Trip 3: No quotes submitted, bidding window expired
  const trip3Res = await api(`/v1/public/guest-links/${guestToken}/cab-requests`, {
    method: 'POST',
    body: {
      clientRequestId: `req_bid_${uniqueId}_3`,
      guestName: 'Priya Sharma',
      phone: '919876543212',
      pickup: 'Kalimpong Bus Stand',
      destinations: ['Siliguri Junction'],
      date: Date.now() + 86400000,
      time: '02:00 PM',
      passengers: 3,
      vehicleType: 'SUV',
    },
  });
  assert.equal(trip3Res.status, 201);
  const tripRef3 = trip3Res.data.reference;

  // Set biddingClosesAt to past and clear nearbyNotifyAt
  await CabRequest.updateOne(
    { reference: tripRef3 },
    { $set: { biddingClosesAt: new Date(Date.now() - 10000), nearbyNotifyAt: null, biddingFallbackAlertSentAt: null } }
  );

  // Run checkBiddingFallbacks
  const fallbackCount1 = await platform.checkBiddingFallbacks(false, { reference: tripRef3 });
  assert.equal(fallbackCount1, 1, 'checkBiddingFallbacks must trigger for Trip 3');

  const trip3AfterFallback: any = await CabRequest.findOne({ reference: tripRef3 }).lean();
  assert.ok(trip3AfterFallback.biddingFallbackAlertSentAt, 'biddingFallbackAlertSentAt must be stamped with timestamp');

  // Run checkBiddingFallbacks second time -> must return 0 (Idempotency, SCEN-051)
  const fallbackCount2 = await platform.checkBiddingFallbacks(false, { reference: tripRef3 });
  assert.equal(fallbackCount2, 0, 'Second run must return 0 alerts (SCEN-051 single alert rule)');
  record('BIDDING_FALLBACK_IDEMPOTENCY', 'PASS', 'Bidding fallback alerted host; second check triggered zero redundant alerts');

  // =========================================================================
  // FLOW 10: Pickup Time Expiration Sweeper (SCEN-047, SCEN-048)
  // =========================================================================
  console.log(`\n--- FLOW 10: Pickup Time Expiration Sweeper ---`);
  // Create Trip 4: Pickup time has passed with unaccepted quotes
  const trip4Res = await api(`/v1/public/guest-links/${guestToken}/cab-requests`, {
    method: 'POST',
    body: {
      clientRequestId: `req_bid_${uniqueId}_4`,
      guestName: 'Vikram Joshi',
      phone: '919876543213',
      pickup: 'Kurseong Tourist Lodge',
      destinations: ['Darjeeling Mall Road'],
      date: Date.now() + 86400000,
      time: '08:00 AM',
      passengers: 2,
      vehicleType: 'SUV',
    },
  });
  assert.equal(trip4Res.status, 201);
  const tripRef4 = trip4Res.data.reference;
  await CabRequest.updateOne({ reference: tripRef4 }, { $set: { nearbyNotifyAt: null } });

  // Driver B quotes on Trip 4
  await api(`/v1/driver/trips/${tripRef4}/quote`, {
    method: 'POST',
    token: driverBToken,
    body: { quotedFare: 1800 },
  });

  // Fast-forward Trip 4 pickup date into the past to test expiration sweeper
  await CabRequest.updateOne({ reference: tripRef4 }, { $set: { date: Date.now() - 3600000, time: '01:00 AM' } });

  // Run expireStaleRequests
  const expiredCount = await platform.expireStaleRequests(false, { reference: tripRef4 });
  assert.equal(expiredCount, 1, 'expireStaleRequests must expire Trip 4');

  const trip4InDb: any = await CabRequest.findOne({ reference: tripRef4 }).lean();
  assert.equal(trip4InDb.status, 'EXPIRED', 'Trip status must transition to EXPIRED');
  assert.equal(trip4InDb.quotes[0].status, 'EXPIRED', 'Unaccepted quote must transition to EXPIRED');
  assert.equal(trip4InDb.cancellationReason, 'No driver was available', 'Reason must record driver unavailability');

  // Quote on expired trip rejected
  const quoteExpiredRes = await api(`/v1/driver/trips/${tripRef4}/quote`, {
    method: 'POST',
    token: driverCToken,
    body: { quotedFare: 1700 },
  });
  assert.equal(quoteExpiredRes.status, 409, 'Quoting on expired trip must return 409 Conflict');
  record('PICKUP_EXPIRATION_SWEEPER', 'PASS', 'Trip 4 expired at pickup time; quote marked EXPIRED; late quotes rejected with 409 Conflict');

  // =========================================================================
  // FLOW 11: Automated Lowest Quote Selection & Tie-Breaker Matching Engine
  // =========================================================================
  console.log(`\n--- FLOW 11: Matching Engine Tie-Breaker (Rating Wins on Tied Fare) ---`);
  // Create Trip 5
  const trip5Res = await api(`/v1/public/guest-links/${guestToken}/cab-requests`, {
    method: 'POST',
    body: {
      clientRequestId: `req_bid_${uniqueId}_5`,
      guestName: 'Arjun Sen',
      phone: '919876543214',
      pickup: 'Mirik Lake',
      destinations: ['NJP Railway Station'],
      date: Date.now() + 86400000,
      time: '12:00 PM',
      passengers: 4,
      vehicleType: 'SUV',
    },
  });
  assert.equal(trip5Res.status, 201);
  const tripRef5 = trip5Res.data.reference;
  await CabRequest.updateOne({ reference: tripRef5 }, { $set: { nearbyNotifyAt: null } });

  // Driver B (Rating 4.7) quotes ₹2,500
  await api(`/v1/driver/trips/${tripRef5}/quote`, {
    method: 'POST',
    token: driverBToken,
    body: { quotedFare: 2500 },
  });

  // Driver C (Rating 4.8) quotes IDENTICAL ₹2,500
  await api(`/v1/driver/trips/${tripRef5}/quote`, {
    method: 'POST',
    token: driverCToken,
    body: { quotedFare: 2500 },
  });

  // Set bidding window closed
  await CabRequest.updateOne(
    { reference: tripRef5 },
    { $set: { biddingClosesAt: new Date(Date.now() - 5000) } }
  );

  // Trigger autoSelectLowestQuotes
  const selectedCount = await platform.autoSelectLowestQuotes(false, { reference: tripRef5 });
  assert.equal(selectedCount, 1, 'autoSelectLowestQuotes must select winning quote');

  const trip5InDb: any = await CabRequest.findOne({ reference: tripRef5 }).lean();
  assert.equal(trip5InDb.status, 'AWAITING_ADVANCE_PAYMENT', 'Status must transition to AWAITING_ADVANCE_PAYMENT');
  assert.equal(
    String(trip5InDb.assignedDriverUserId),
    String(driverCId),
    'Driver C (Rating 4.8) must win over Driver B (Rating 4.7) on identical ₹2,500 fare'
  );

  const winningQuote5 = trip5InDb.quotes.find((q: any) => String(q.driverId) === String(driverCId));
  const losingQuote5 = trip5InDb.quotes.find((q: any) => String(q.driverId) === String(driverBId));
  assert.equal(winningQuote5.status, 'ACCEPTED', 'Driver C quote must be ACCEPTED');
  assert.equal(losingQuote5.status, 'REJECTED', 'Driver B quote must be REJECTED');
  assert.equal(losingQuote5.outbid, true, 'Driver B quote must have outbid: true');
  record('TIE_BREAKER_MATCHING_ENGINE', 'PASS', 'Tie-breaker verified: On identical ₹2,500 fare, Driver C (Rating 4.8) won over Driver B (Rating 4.7)');

  // =========================================================================
  // FLOW 12: WhatsApp Anti-Spam Containment Final Verification
  // =========================================================================
  console.log(`\n--- FLOW 12: WhatsApp Interceptor Containment Verification ---`);
  console.log(`📱 Total Outbound WhatsApp Dispatches Intercepted: ${capturedOutboundWhatsApp.length}`);
  assert.ok(capturedOutboundWhatsApp.length > 0, 'WhatsApp notifications should have fired and been intercepted');
  record('WHATSAPP_CONTAINMENT_VERIFIED', 'PASS', `${capturedOutboundWhatsApp.length} notifications safely intercepted with 0 external bytes dispatched`);

  // =========================================================================
  // CLEANUP: Clean test records tagged with QA_TAG
  // =========================================================================
  console.log(`\n--- CLEANUP: Removing Test Run Records ---`);
  await CabRequest.deleteMany({ reference: { $in: [tripRef1, tripRef2, tripRef3, tripRef4, tripRef5] } });
  await User.deleteMany({ email: { $in: [hostEmail, driverAEmail, driverBEmail, driverCEmail] } });
  await getGuestLinkModel(false).deleteMany({ tenantKey: hostEmail });
  record('CLEANUP_COMPLETED', 'PASS', 'Cleaned up temporary QA records from MongoDB');

} catch (err: any) {
  console.error('\n❌ FATAL TEST FAILURE:', err);
  manifest.push({ step: 'TEST_EXECUTION', status: 'FAIL', details: err?.message || String(err) });
  process.exitCode = 1;
} finally {
  server.close();
  await mongoose.disconnect();
}

console.log('\n=========================================================================');
console.log('🏆 GUEST JOURNEY & MULTI-DRIVER BIDDING TEST MANIFEST');
console.log('=========================================================================');
manifest.forEach((m) => console.log(`${m.status === 'PASS' ? '✅' : '❌'} [${m.step}]: ${m.details}`));
const passCount = manifest.filter((m) => m.status === 'PASS').length;
const failCount = manifest.filter((m) => m.status === 'FAIL').length;
console.log(`\nTOTAL PASSED: ${passCount} / ${manifest.length} | FAILED: ${failCount}`);
if (failCount === 0) {
  console.log('🎉 ALL COMPETITIVE BIDDING & GUEST JOURNEY TESTS PASSED PERFECTLY!\n');
} else {
  console.log('💥 SOME ASSERTIONS FAILED. INVESTIGATE LOGS ABOVE.\n');
}
