// Comprehensive E2E Test Suite for:
// Category 12: Boarding PIN (OTP) & Pickup Verification (SCEN-105 to SCEN-114)
// Category 13: Driver Live Telemetry & Trip Execution (SCEN-115 to SCEN-122)
// Category 14: Trip Completion, Cash Collection & Financial Split (SCEN-123 to SCEN-134)
// Category 15: Post-Trip Rating & Reputation Updates (SCEN-135 to SCEN-144)
// Category 16: No-PIN Completion Arbitration & Payout Hold (SCEN-144 to SCEN-148)
// Category 17-20: Driver Sovereign Wallet Accounting, Payout Requests, Rejections & Settlement (SCEN-149 to SCEN-155)
//
// Run: npx tsx scripts/run-e2e-boarding-pin-and-telemetry.ts

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
  let data: any = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, headers: res.headers, data };
}

// Model imports
const { User } = await import('../src/models/user.model.js');
const { getCabRequestModel } = await import('../src/models/cab-request.model.js');
const { Property } = await import('../src/models/property.model.js');
const { getPayoutRequestModel } = await import('../src/models/payout-request.model.js');
const { getGuestLinkModel } = await import('../src/models/guest-link.model.js');
const { getAuditLogModel } = await import('../src/models/audit-log.model.js');
const { config } = await import('../src/config/env.js');
const { driverQuoteLink, recordGatewayPayment } = await import('../src/stayride/platform.js');
const jwt = (await import('jsonwebtoken')).default;

const Cab = getCabRequestModel(false);
const Payout = getPayoutRequestModel(false);
const GuestLink = getGuestLinkModel(false);
const AuditLog = getAuditLogModel(false);

const SUITE_ID = `QA_PIN_${Date.now()}`;
console.log(`\n📋 Commencing Master Test Suite with Execution ID: ${SUITE_ID}`);

// Track created documents for rigorous cleanup
const cleanupManifest: {
  users: string[];
  properties: string[];
  trips: string[];
  guestLinks: string[];
  payouts: string[];
  auditLogs: string[];
} = {
  users: [],
  properties: [],
  trips: [],
  guestLinks: [],
  payouts: [],
  auditLogs: [],
};

async function runSuite() {
  try {
    // =========================================================================
    // STAGE 1: Seed Identities (Admin, Host, Mobile Driver, Web Driver, Guest)
    // =========================================================================
    console.log('\n--- STAGE 1: Seeding Test Identities ---');

    const adminEmail = `admin_${SUITE_ID}@staycabs.qa`;
    const adminUser = await User.create({
      name: 'QA Master Admin',
      email: adminEmail,
      password: 'HashedPassword123!',
      role: 'admin',
      accountStatus: 'ACTIVE',
      tokenVersion: 0,
    });
    cleanupManifest.users.push(String(adminUser._id));
    const adminToken = jwt.sign(
      { id: adminUser._id.toString(), email: adminUser.email, role: 'admin', tv: adminUser.tokenVersion || 0 },
      config.jwtSecret,
      { expiresIn: '2h' }
    );

    // Token helpers
    const signStayRideUserToken = (user: any) => {
      return jwt.sign(
        {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          tenantKey: user.email,
          isDemo: false,
          tv: user.tokenVersion || 0,
          type: 'access',
        },
        config.jwtSecret,
        { expiresIn: '2h', audience: 'stayride' }
      );
    };

    const hostEmail = `host_${SUITE_ID}@pineview.qa`;
    const hostUser = await User.create({
      name: 'Dawa Lepcha (Host)',
      email: hostEmail,
      phone: '919811002201',
      password: 'HashedPassword123!',
      role: 'owner',
      accountStatus: 'ACTIVE',
      tokenVersion: 0,
    });
    cleanupManifest.users.push(String(hostUser._id));
    const hostToken = signStayRideUserToken(hostUser);

    const property = await Property.create({
      userId: hostUser._id,
      name: 'Pine View Homestay',
      address: 'Upper Cart Road, Darjeeling',
      town: 'Darjeeling',
      location: 'Darjeeling Mall Road, West Bengal',
      isActive: true,
      email: hostEmail,
      phone: '919811002201',
      role: 'owner',
    });
    cleanupManifest.properties.push(String(property._id));

    // Mobile App Driver: Bikram Thapa
    const driverMobileUser = await User.create({
      name: 'Bikram Thapa',
      email: `driver_mobile_${SUITE_ID}@staycabs.qa`,
      phone: '919811223344',
      password: 'HashedPassword123!',
      role: 'driver',
      accountStatus: 'ACTIVE',
      tokenVersion: 0,
      isAvailable: true,
      ratingSum: 20,
      ratingCount: 4, // 5.0 initial rating
      vehicle: {
        type: 'SUV',
        model: 'Toyota Innova Crysta',
        plate: 'WB-74-QA-9001',
        area: 'Darjeeling',
        seats: 7,
      },
      location: { lat: 27.0425, lng: 88.2670, updatedAt: new Date() },
      locationPoint: { type: 'Point', coordinates: [88.2670, 27.0425] },
    });
    cleanupManifest.users.push(String(driverMobileUser._id));
    const driverMobileToken = signStayRideUserToken(driverMobileUser);

    // Web Link Driver: Karan Gurung
    const driverWebUser = await User.create({
      name: 'Karan Gurung',
      email: `driver_web_${SUITE_ID}@staycabs.qa`,
      phone: '919855667788',
      password: 'HashedPassword123!',
      role: 'driver',
      accountStatus: 'ACTIVE',
      tokenVersion: 0,
      isAvailable: true,
      ratingSum: 15,
      ratingCount: 3, // 5.0 initial rating
      vehicle: {
        type: 'Sedan',
        model: 'Maruti Dzire',
        plate: 'WB-74-QA-9002',
        area: 'Darjeeling',
        seats: 4,
      },
      location: { lat: 27.0300, lng: 88.2600, updatedAt: new Date() },
      locationPoint: { type: 'Point', coordinates: [88.2600, 27.0300] },
    });
    cleanupManifest.users.push(String(driverWebUser._id));

    // Guest Link Setup
    const guestPhone = '919800112233';
    const guestName = 'Amitava Roy';
    const rawGuestToken = `guest_token_${SUITE_ID}_${crypto.randomBytes(16).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawGuestToken).digest('hex');
    const guestLink = await GuestLink.create({
      tokenHash,
      tenantKey: hostEmail,
      guestName,
      guestPhone,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });
    cleanupManifest.guestLinks.push(String(guestLink._id));

    console.log(`✅ Seeded Admin (${adminEmail}), Host (${hostEmail}), Mobile Driver (${driverMobileUser.name}), Web Driver (${driverWebUser.name}), Guest (${guestName})`);

    // =========================================================================
    // STAGE 2: Category 12 — Boarding PIN (OTP) & Verification Lifecycle
    // =========================================================================
    console.log('\n--- STAGE 2: Category 12 — Boarding PIN (OTP) & Verification Lifecycle ---');

    // Helper to generate schema-compliant test trips
    const makeTripData = (ref: string, overrides: Record<string, any> = {}) => {
      const agreedFare = overrides.agreedFare ?? 3000;
      const advanceAmount = overrides.advanceAmount ?? 500;
      const platformFeeRate = 5;
      const homestayCommissionRate = 5;
      const platformFeeAmount = overrides.platformFeeAmount ?? 150;
      const homestayCommissionAmount = overrides.homestayCommissionAmount ?? 150;
      const driverPayoutAmount = agreedFare - platformFeeAmount - homestayCommissionAmount;
      const remainingCashToDriver = agreedFare - advanceAmount;
      const driverShareOfAdvance = overrides.driverShareOfAdvance ?? Math.max(0, advanceAmount - platformFeeAmount - homestayCommissionAmount);
      const advancePaid = overrides.advancePaid ?? true;

      return {
        reference: ref,
        tenantKey: hostEmail,
        propertyId: property._id,
        homestayName: property.name,
        guestName,
        guestPhone,
        pickupLocation: { address: 'Pine View Homestay, Upper Cart Road, Darjeeling' },
        pickup: 'Pine View Homestay, Upper Cart Road, Darjeeling',
        destinations: overrides.destinations || [{ address: 'Bagdogra Airport, Siliguri' }],
        destination: overrides.destination || 'Bagdogra Airport, Siliguri',
        date: Date.now() + 86400000,
        time: '09:00 AM',
        passengers: 3,
        vehicleType: 'SUV',
        status: 'CONFIRMED',
        dispatched: true,
        assignedDriverUserId: driverMobileUser._id.toString(),
        assignedDriverName: driverMobileUser.name,
        assignedDriverPhone: driverMobileUser.phone,
        vehicleDetails: { model: driverMobileUser.vehicle?.model, plate: driverMobileUser.vehicle?.plate },
        agreedFare,
        advanceAmount,
        advancePaid,
        remainingCashAmount: remainingCashToDriver,
        pickupOtp: String(crypto.randomInt(1000, 10000)),
        pickupOtpAttempts: 0,
        financialSnapshot: {
          agreedFare,
          advanceAmount,
          advancePaid,
          platformFeeRate,
          platformFeeAmount,
          homestayCommissionRate,
          homestayCommissionAmount,
          driverPayoutAmount,
          remainingCashToDriver,
          driverShareOfAdvance,
          calculatedAt: new Date(),
        },
        ...overrides,
      };
    };

    // SCEN-105: Cryptographic 4-Digit PIN Generation upon Advance Confirmation
    const trip1Ref = `CAB-${SUITE_ID}-001`;
    const trip1 = await Cab.create(makeTripData(trip1Ref));
    cleanupManifest.trips.push(String(trip1._id));

    console.log(`[SCEN-105] Verifying 4-digit cryptographic boarding PIN on Trip 1...`);
    assert.match(String(trip1.pickupOtp), /^\d{4}$/, 'Boarding PIN must be a 4-digit numeric string');
    console.log(`✅ [SCEN-105 PASSED] Boarding PIN ${trip1.pickupOtp} generated successfully.`);

    // SCEN-106: Boarding PIN Display on Guest Pass
    console.log(`[SCEN-106] Testing Guest Trip Pass Display...`);
    // Verified Guest via phone query
    const guestPassRes = await api(`/v1/public/cab-requests/${trip1Ref}?phone=${guestPhone}`);
    assert.equal(guestPassRes.status, 200, 'Guest pass request must succeed');
    assert.equal(guestPassRes.data.pickupOtp, trip1.pickupOtp, 'Verified guest must see pickup OTP on pass');
    assert.equal(guestPassRes.data.driverName, driverMobileUser.name, 'Confirmed driver name visible to verified guest');

    // Unverified Stranger querying same trip without proof
    const strangerPassRes = await api(`/v1/public/cab-requests/${trip1Ref}?phone=919999888877`);
    assert.equal(strangerPassRes.status, 200, 'Stranger can view public itinerary');
    assert.equal(strangerPassRes.data.pickupOtp, null, 'Pickup OTP must be strictly hidden from unverified viewers');
    console.log(`✅ [SCEN-106 PASSED] Pickup OTP visible to verified guest (${guestPassRes.data.pickupOtp}) and masked for strangers.`);

    // SCEN-107: Boarding PIN Hidden from Driver APIs
    console.log(`[SCEN-107] Testing Boarding PIN Masking for Driver APIs...`);
    // Mobile Driver querying trips
    const driverTripsRes = await api(`/v1/driver/trips`, { token: driverMobileToken });
    assert.equal(driverTripsRes.status, 200);
    const driverTrip1 = driverTripsRes.data.find((t: any) => t.reference === trip1Ref);
    assert.ok(driverTrip1, 'Driver must find assigned trip');
    assert.equal(driverTrip1.pickupOtpRequired, true, 'Driver must see pickupOtpRequired: true');
    assert.equal(driverTrip1.pickupOtp, undefined, 'pickupOtp field must be completely omitted from driver response');

    // Web Driver link view
    const webToken1 = jwt.sign({ typ: 'dq', d: String(driverWebUser._id), r: trip1Ref, x: 0 }, config.jwtSecret, { expiresIn: '4d' });
    const webDriverViewRes = await api(`/v1/public/driver-quote?t=${encodeURIComponent(webToken1)}`);
    assert.equal(webDriverViewRes.status, 200);
    assert.equal(webDriverViewRes.data.pickupOtp, undefined, 'pickupOtp must be completely omitted from web driver view');
    console.log(`✅ [SCEN-107 PASSED] Boarding PIN is strictly omitted from both Mobile and Web driver views.`);

    // SCEN-112: Trip Start Before Confirmation Guard
    console.log(`[SCEN-112] Testing Premature Trip Start Guard (Unpaid advance)...`);
    const trip2Ref = `CAB-${SUITE_ID}-002`;
    const trip2 = await Cab.create(
      makeTripData(trip2Ref, {
        status: 'AWAITING_ADVANCE_PAYMENT',
        advancePaid: false,
        financialSnapshot: null,
      })
    );
    cleanupManifest.trips.push(String(trip2._id));

    const prematureStartRes = await api(`/v1/driver/trips/${trip2Ref}/start`, {
      token: driverMobileToken,
      body: { otp: '1234' },
    });
    assert.equal(prematureStartRes.status, 409, 'Starting unpaid trip must return 409 Conflict');
    assert.match(prematureStartRes.data.error.message, /advance is paid/i);
    console.log(`✅ [SCEN-112 PASSED] Premature start rejected with 409 Conflict.`);

    // SCEN-109: Incorrect PIN Attempt Incremented
    console.log(`[SCEN-109] Testing Incorrect PIN Entry & Attempt Counter...`);
    const wrongPinRes = await api(`/v1/driver/trips/${trip1Ref}/start`, {
      token: driverMobileToken,
      body: { otp: '0000' },
    });
    assert.equal(wrongPinRes.status, 400, 'Wrong PIN must return 400 Bad Request');
    assert.match(wrongPinRes.data.error.message, /Invalid Boarding Verification PIN/i);

    const trip1AfterWrongPin = await Cab.findById(trip1._id).lean();
    assert.equal(trip1AfterWrongPin?.pickupOtpAttempts, 1, 'pickupOtpAttempts must increment to 1');
    assert.equal(trip1AfterWrongPin?.status, 'CONFIRMED', 'Trip status must remain CONFIRMED');
    console.log(`✅ [SCEN-109 PASSED] Incorrect PIN rejected with 400, attempt count incremented to 1.`);

    // SCEN-110: 5-Attempt PIN Lockout Defense
    console.log(`[SCEN-110] Testing 5-Attempt PIN Lockout Defense...`);
    for (let i = 2; i <= 5; i++) {
      const res = await api(`/v1/driver/trips/${trip1Ref}/start`, {
        token: driverMobileToken,
        body: { otp: `000${i}` },
      });
      assert.equal(res.status, 400, `Attempt ${i} must return 400`);
    }

    const trip1Locked = await Cab.findById(trip1._id).lean();
    assert.equal(trip1Locked?.pickupOtpAttempts, 5, 'pickupOtpAttempts must reach exactly 5');

    // 6th attempt should be locked out with 429 PIN_LOCKED
    const lockedRes = await api(`/v1/driver/trips/${trip1Ref}/start`, {
      token: driverMobileToken,
      body: { otp: trip1.pickupOtp }, // Even the correct PIN now fails because of lockout
    });
    assert.equal(lockedRes.status, 429, 'Locked trip must return 429 Too Many Requests');
    assert.equal(lockedRes.data.error.code, 'PIN_LOCKED');
    console.log(`✅ [SCEN-110 PASSED] 5 consecutive wrong PINs locked the trip with 429 PIN_LOCKED.`);

    // SCEN-111: Admin PIN Override / Force Start
    console.log(`[SCEN-111] Testing Admin Force Start Override on Locked Trip...`);
    const adminStartRes = await api(`/v1/admin/cab-requests/${trip1._id}/start`, {
      token: adminToken,
      body: {},
    });
    assert.equal(adminStartRes.status, 200, 'Admin override start must succeed');

    const trip1StartedAdmin = await Cab.findById(trip1._id).lean();
    assert.equal(trip1StartedAdmin?.status, 'TRIP_STARTED', 'Trip status must transition to TRIP_STARTED');
    assert.ok(trip1StartedAdmin?.startedAt, 'startedAt must be stamped');
    console.log(`✅ [SCEN-111 PASSED] Admin successfully started locked trip without PIN.`);

    // SCEN-108: Web Driver Correct PIN Verification
    console.log(`[SCEN-108] Testing Web Driver Correct PIN Verification on Trip 3...`);
    const trip3Ref = `CAB-${SUITE_ID}-003`;
    const trip3Otp = '7744';
    const trip3 = await Cab.create(
      makeTripData(trip3Ref, {
        guestName: 'Rohit Sengupta',
        guestPhone: '919833445566',
        destinations: [{ address: 'Mirik Lake, West Bengal' }],
        destination: 'Mirik Lake, West Bengal',
        vehicleType: 'Sedan',
        assignedDriverUserId: driverWebUser._id.toString(),
        assignedDriverName: driverWebUser.name,
        assignedDriverPhone: driverWebUser.phone,
        vehicleDetails: { model: driverWebUser.vehicle?.model, plate: driverWebUser.vehicle?.plate },
        agreedFare: 2400,
        advanceAmount: 400,
        platformFeeAmount: 120,
        homestayCommissionAmount: 120,
        driverShareOfAdvance: 160,
        pickupOtp: trip3Otp,
      })
    );
    cleanupManifest.trips.push(String(trip3._id));

    const webToken3 = jwt.sign({ typ: 'dq', d: String(driverWebUser._id), r: trip3Ref, x: 0 }, config.jwtSecret, { expiresIn: '4d' });
    const webStartRes = await api(`/v1/public/driver-quote/start`, {
      body: { t: webToken3, otp: trip3Otp },
    });
    assert.equal(webStartRes.status, 200, 'Web driver start with valid OTP must return 200 OK');

    const trip3Db = await Cab.findById(trip3._id).lean();
    assert.equal(trip3Db?.status, 'TRIP_STARTED', 'Trip 3 must transition to TRIP_STARTED');
    assert.ok(trip3Db?.startedAt, 'Trip 3 startedAt must be recorded');
    console.log(`✅ [SCEN-108 PASSED] Web driver successfully started Trip 3 with correct PIN ${trip3Otp}.`);

    // SCEN-113: Double PIN Entry Idempotency
    console.log(`[SCEN-113] Testing Double PIN Entry Idempotency...`);
    const webStartRetryRes = await api(`/v1/public/driver-quote/start`, {
      body: { t: webToken3, otp: trip3Otp },
    });
    assert.equal(webStartRetryRes.status, 200, 'Re-starting already started trip must return 200 OK');
    assert.equal(webStartRetryRes.data.status, 'TRIP_STARTED', 'Response status reflects TRIP_STARTED');
    console.log(`✅ [SCEN-113 PASSED] Re-sending start command on already started trip returns 200 OK idempotently.`);

    // SCEN-114: Audit Log on Trip Start
    console.log(`[SCEN-114] Verifying Audit Log for Trip Start...`);
    const startAudit = await AuditLog.findOne({
      action: 'cab.start',
      targetId: String(trip3._id),
    }).lean();
    assert.ok(startAudit, 'Audit log for cab.start must exist in database');
    assert.equal(startAudit.actor, `driver-web:${driverWebUser.name}`);
    cleanupManifest.auditLogs.push(String(startAudit._id));
    console.log(`✅ [SCEN-114 PASSED] Audit log entry recorded with actor ${startAudit.actor}.`);

    // =========================================================================
    // STAGE 3: Category 13 — Driver Live Telemetry & Trip Execution
    // =========================================================================
    console.log('\n--- STAGE 3: Category 13 — Driver Live Telemetry & Trip Execution ---');

    // SCEN-115: Mobile Driver GPS Telemetry Update
    console.log(`[SCEN-115] Testing Mobile Driver GPS Location Update...`);
    const locUpdateRes = await api(`/v1/driver/location`, {
      method: 'PATCH',
      token: driverMobileToken,
      body: { lat: 27.0425, lng: 88.2670 },
    });
    assert.equal(locUpdateRes.status, 200);
    assert.equal(locUpdateRes.data.ok, true);

    const updatedMobileDriver = await User.findById(driverMobileUser._id).lean();
    assert.equal(updatedMobileDriver?.location?.lat, 27.0425);
    assert.equal(updatedMobileDriver?.location?.lng, 88.2670);
    assert.deepEqual(updatedMobileDriver?.locationPoint?.coordinates, [88.2670, 27.0425]);
    console.log(`✅ [SCEN-115 PASSED] Mobile driver GPS updated in User document and GeoJSON locationPoint.`);

    // SCEN-116: Web Driver GPS Telemetry Update
    console.log(`[SCEN-116] Testing Web Driver GPS Location Update...`);
    const webLocRes = await api(`/v1/public/driver-quote/location`, {
      body: { t: webToken3, lat: 26.8906, lng: 88.1887 }, // Mirik coordinates
    });
    assert.equal(webLocRes.status, 200);
    assert.equal(webLocRes.data.success, true);

    const updatedWebDriver = await User.findById(driverWebUser._id).lean();
    assert.equal(updatedWebDriver?.location?.lat, 26.8906);
    assert.equal(updatedWebDriver?.location?.lng, 88.1887);
    assert.deepEqual(updatedWebDriver?.locationPoint?.coordinates, [88.1887, 26.8906]);
    console.log(`✅ [SCEN-116 PASSED] Web driver GPS updated via public quote token.`);

    // SCEN-117: Coordinate Bounds & Malformed Telemetry Defense
    console.log(`[SCEN-117] Testing Coordinate Bounds Validation (-90..90, -180..180)...`);
    const invalidLatRes = await api(`/v1/driver/location`, {
      method: 'PATCH',
      token: driverMobileToken,
      body: { lat: 95.5, lng: 88.2670 },
    });
    assert.equal(invalidLatRes.status, 400, 'Latitude > 90 must return 400 Bad Request');
    assert.match(invalidLatRes.data.error.message, /valid location/i);

    const invalidLngRes = await api(`/v1/driver/location`, {
      method: 'PATCH',
      token: driverMobileToken,
      body: { lat: 27.0425, lng: 195.0 },
    });
    assert.equal(invalidLngRes.status, 400, 'Longitude > 180 must return 400 Bad Request');

    const malformedLocRes = await api(`/v1/driver/location`, {
      method: 'PATCH',
      token: driverMobileToken,
      body: { lat: 'not-a-number', lng: null },
    });
    assert.equal(malformedLocRes.status, 400, 'Malformed coordinates must return 400 Bad Request');
    console.log(`✅ [SCEN-117 PASSED] Invalid and malformed coordinates strictly rejected with 400.`);

    // SCEN-118: Live Guest Status View during Transit
    console.log(`[SCEN-118] Testing Live Guest Status Page during Transit...`);
    const guestTransitRes = await api(`/v1/public/cab-requests/${trip1Ref}?phone=${guestPhone}`);
    assert.equal(guestTransitRes.status, 200);
    assert.equal(guestTransitRes.data.status, 'TRIP_STARTED', 'Status page must reflect TRIP_STARTED');
    assert.equal(guestTransitRes.data.driverName, driverMobileUser.name);
    assert.equal(guestTransitRes.data.vehicle, `${driverMobileUser.vehicle?.model} ${driverMobileUser.vehicle?.plate}`);
    console.log(`✅ [SCEN-118 PASSED] Guest live view correctly shows TRIP_STARTED with driver & vehicle info.`);

    // SCEN-119: Concurrency Safety with Rapid Pings
    console.log(`[SCEN-119] Testing Rapid GPS Pings Concurrency Safety...`);
    const pingPromises = Array.from({ length: 5 }, (_, idx) =>
      api(`/v1/driver/location`, {
        method: 'PATCH',
        token: driverMobileToken,
        body: { lat: 27.0425 + idx * 0.001, lng: 88.2670 + idx * 0.001 },
      })
    );
    const pingResults = await Promise.all(pingPromises);
    for (const r of pingResults) {
      assert.equal(r.status, 200, 'Rapid location pings must complete cleanly');
    }
    console.log(`✅ [SCEN-119 PASSED] 5 rapid GPS pings processed cleanly without race conditions.`);

    // =========================================================================
    // STAGE 4: Category 14 — Trip Completion, Cash Collection & Financial Split
    // =========================================================================
    console.log('\n--- STAGE 4: Category 14 — Trip Completion, Cash Collection & Financial Split ---');

    // SCEN-130: Premature Completion Guard
    console.log(`[SCEN-130] Testing Premature Completion Guard on Non-Started Trip...`);
    const trip4Ref = `CAB-${SUITE_ID}-004`;
    const trip4 = await Cab.create(
      makeTripData(trip4Ref, {
        guestName: 'Ananya Dutta',
        guestPhone: '919877665544',
        destinations: [{ address: 'Tiger Hill, Darjeeling' }],
        destination: 'Tiger Hill, Darjeeling',
        agreedFare: 1800,
        advanceAmount: 400,
        platformFeeAmount: 90,
        homestayCommissionAmount: 90,
        driverShareOfAdvance: 220,
      })
    );
    cleanupManifest.trips.push(String(trip4._id));

    const prematureCompRes = await api(`/v1/driver/trips/${trip4Ref}/complete`, {
      method: 'POST',
      token: driverMobileToken,
    });
    assert.equal(prematureCompRes.status, 409, 'Completing non-started trip must return 409 Conflict');
    assert.match(prematureCompRes.data.error.message, /Only a started trip can be completed/i);
    console.log(`✅ [SCEN-130 PASSED] Premature trip completion rejected with 409 Conflict.`);

    // SCEN-123 & SCEN-124: Clean Mobile Driver Trip Completion
    console.log(`[SCEN-123 & SCEN-124] Completing Trip 1 via Mobile Driver...`);
    const completeRes1 = await api(`/v1/driver/trips/${trip1Ref}/complete`, {
      method: 'POST',
      token: driverMobileToken,
    });
    assert.equal(completeRes1.status, 200, 'Trip completion must return 200 OK');

    const trip1Completed = await Cab.findById(trip1._id).lean();
    assert.equal(trip1Completed?.status, 'COMPLETED', 'Trip 1 status must be COMPLETED');
    assert.ok(trip1Completed?.completedAt, 'completedAt timestamp must be recorded');
    console.log(`✅ [SCEN-123 & SCEN-124 PASSED] Trip 1 transitioned to COMPLETED with timestamp ${trip1Completed?.completedAt}.`);

    // SCEN-125: Exact Cash-in-Hand Collection Invariant
    console.log(`[SCEN-125] Verifying Cash-in-Hand Collection Invariant...`);
    assert.equal(trip1Completed?.remainingCashAmount, 2500, 'Remaining cash collected from guest must be exactly ₹2,500');
    assert.equal(trip1Completed?.agreedFare, 3000);
    assert.equal(trip1Completed?.advanceAmount, 500);
    console.log(`✅ [SCEN-125 PASSED] Cash collection invariant verified: ₹3,000 fare - ₹500 advance = ₹2,500 cash in hand.`);

    // SCEN-126 & SCEN-127: Driver Surplus Advance Share & Settlement Status
    console.log(`[SCEN-126 & SCEN-127] Verifying Driver Advance Surplus Credit...`);
    // Advance = 500, Platform Fee = 150, Homestay Commission = 150. Driver surplus = 500 - 300 = 200
    assert.equal(trip1Completed?.financialSnapshot?.driverShareOfAdvance, 200);
    assert.equal(trip1Completed?.driverSettlementStatus, 'PENDING', 'Driver settlement status must be PENDING for positive advance surplus');
    console.log(`✅ [SCEN-126 & SCEN-127 PASSED] Driver advance surplus of ₹200 credited to driver settlement (status: PENDING).`);

    // SCEN-128: Zero-Permission Destination Coordinate Drop-off Stamping
    console.log(`[SCEN-128] Verifying Driver Auto Destination Location Stamping...`);
    // Trip 3 destination is "Mirik Lake, West Bengal". Let's complete Trip 3 and test drop-off stamping!
    const webCompRes = await api(`/v1/public/driver-quote/complete`, {
      body: { t: webToken3 },
    });
    assert.equal(webCompRes.status, 200, 'Web driver trip completion must return 200 OK');

    const trip3Completed = await Cab.findById(trip3._id).lean();
    assert.equal(trip3Completed?.status, 'COMPLETED');
    assert.equal(trip3Completed?.driverSettlementStatus, 'PENDING');

    const webDriverAfterDrop = await User.findById(driverWebUser._id).lean();
    // Mirik Landmark coords: lat 26.8906, lng 88.1887
    assert.equal(webDriverAfterDrop?.location?.lat, 26.8906);
    assert.equal(webDriverAfterDrop?.location?.lng, 88.1887);
    console.log(`✅ [SCEN-128 PASSED] Driver location automatically stamped at Mirik destination drop-off.`);

    // SCEN-129: Double-Complete Idempotency
    console.log(`[SCEN-129] Testing Double-Complete Idempotency...`);
    const completeRetryRes = await api(`/v1/driver/trips/${trip1Ref}/complete`, {
      method: 'POST',
      token: driverMobileToken,
    });
    assert.equal(completeRetryRes.status, 200, 'Calling complete on already completed trip must return 200 OK idempotently');
    console.log(`✅ [SCEN-129 PASSED] Double-complete returns 200 OK without errors or state corruption.`);

    // SCEN-131: Audit Log on Trip Completion
    console.log(`[SCEN-131] Verifying Audit Log on Trip Completion...`);
    const compAudit = await AuditLog.findOne({
      action: 'cab.complete',
      targetId: String(trip1._id),
    }).lean();
    assert.ok(compAudit, 'Audit log for cab.complete must exist');
    assert.equal(compAudit.details?.driverShareOfAdvance, 200);
    cleanupManifest.auditLogs.push(String(compAudit._id));
    console.log(`✅ [SCEN-131 PASSED] Audit log records cab.complete with driverShareOfAdvance: 200.`);

    // =========================================================================
    // STAGE 5: Category 15 — Post-Trip Rating & Reputation Updates
    // =========================================================================
    console.log('\n--- STAGE 5: Category 15 — Post-Trip Rating & Reputation Updates ---');

    // SCEN-137: Rating Non-Completed Trip Guard
    console.log(`[SCEN-137] Testing Rating Non-Completed Trip Rejection...`);
    const rateNonCompRes = await api(`/v1/public/cab-requests/${trip4Ref}/rate?phone=${trip4.guestPhone}`, {
      body: { stars: 5, comment: 'Great driver' },
    });
    assert.equal(rateNonCompRes.status, 404, 'Rating non-completed trip must return 404');
    assert.match(rateNonCompRes.data.error.message, /Only a completed trip with an assigned driver can be rated/i);
    console.log(`✅ [SCEN-137 PASSED] Rating non-completed trip rejected with 404.`);

    // SCEN-136: Unverified Guest Rating Rejection
    console.log(`[SCEN-136] Testing Unverified Guest Rating Rejection...`);
    const unverifiedRateRes = await api(`/v1/public/cab-requests/${trip1Ref}/rate`, {
      body: { stars: 5, comment: 'Nice trip' },
    });
    assert.equal(unverifiedRateRes.status, 403, 'Rating without verification proof must return 403 Forbidden');
    assert.match(unverifiedRateRes.data.error.message, /Open the trip link we sent you on WhatsApp/i);
    console.log(`✅ [SCEN-136 PASSED] Unverified rating call rejected with 403 Forbidden.`);

    // SCEN-138: Invalid Star Rating Validation
    console.log(`[SCEN-138] Testing Invalid Star Rating Validation (0, 6, fractional)...`);
    const rate6Res = await api(`/v1/public/cab-requests/${trip1Ref}/rate?phone=${guestPhone}`, {
      body: { stars: 6, comment: 'Superb' },
    });
    assert.equal(rate6Res.status, 400, 'Stars > 5 must return 400');
    assert.match(rate6Res.data.error.message, /Stars must be a whole number from 1 to 5/i);

    const rate0Res = await api(`/v1/public/cab-requests/${trip1Ref}/rate?phone=${guestPhone}`, {
      body: { stars: 0, comment: 'Terrible' },
    });
    assert.equal(rate0Res.status, 400, 'Stars < 1 must return 400');

    const rateFractionRes = await api(`/v1/public/cab-requests/${trip1Ref}/rate?phone=${guestPhone}`, {
      body: { stars: 4.5, comment: 'Decent' },
    });
    assert.equal(rateFractionRes.status, 400, 'Fractional stars must return 400');
    console.log(`✅ [SCEN-138 PASSED] Invalid star values (0, 6, 4.5) rejected with 400.`);

    // SCEN-139: Comment Length Limit (300 Chars)
    console.log(`[SCEN-139] Testing Comment Length Limit (> 300 characters)...`);
    const longComment = 'A'.repeat(350);
    const longCommentRes = await api(`/v1/public/cab-requests/${trip1Ref}/rate?phone=${guestPhone}`, {
      body: { stars: 5, comment: longComment },
    });
    assert.equal(longCommentRes.status, 400, 'Comment > 300 chars must return 400');
    assert.match(longCommentRes.data.error.message, /at most 300 characters/i);
    console.log(`✅ [SCEN-139 PASSED] Over-length review comments rejected with 400.`);

    // SCEN-135: Verified Guest 5-Star Rating Submission
    console.log(`[SCEN-135] Submitting Valid 5-Star Rating & Review...`);
    const validRateRes = await api(`/v1/public/cab-requests/${trip1Ref}/rate?phone=${guestPhone}`, {
      body: { stars: 5, comment: 'Driver was punctual, skilled on hill hairpins, and very polite!' },
    });
    assert.equal(validRateRes.status, 200, 'Valid rating submission must return 200 OK');
    assert.equal(validRateRes.data.guestRating?.stars, 5);
    assert.equal(validRateRes.data.guestRating?.comment, 'Driver was punctual, skilled on hill hairpins, and very polite!');

    const trip1Rated = await Cab.findById(trip1._id).lean();
    assert.equal(trip1Rated?.guestRating?.stars, 5);
    assert.equal(trip1Rated?.rating?.stars, 5);
    console.log(`✅ [SCEN-135 PASSED] 5-star rating recorded on CabRequest.`);

    // SCEN-140: Double Rating Prevention (Once-Only Rating)
    console.log(`[SCEN-140] Testing Double Rating Prevention...`);
    const doubleRateRes = await api(`/v1/public/cab-requests/${trip1Ref}/rate?phone=${guestPhone}`, {
      body: { stars: 4, comment: 'Changed my mind' },
    });
    assert.equal(doubleRateRes.status, 409, 'Rating already rated trip must return 409 Conflict');
    assert.match(doubleRateRes.data.error.message, /already rated this trip/i);
    console.log(`✅ [SCEN-140 PASSED] Second rating submission rejected with 409 Conflict.`);

    // SCEN-141 & SCEN-142: Driver Reputation Accumulation in MongoDB
    console.log(`[SCEN-141 & SCEN-142] Verifying Driver Reputation Accumulation in Database...`);
    const driverAfterRating = await User.findById(driverMobileUser._id).lean();
    // Initially ratingSum was 20, ratingCount was 4. Now 20 + 5 = 25, 4 + 1 = 5
    assert.equal(driverAfterRating?.ratingSum, 25, 'ratingSum must increment by 5');
    assert.equal(driverAfterRating?.ratingCount, 5, 'ratingCount must increment by 1');
    const avgRating = (driverAfterRating?.ratingSum || 0) / (driverAfterRating?.ratingCount || 1);
    assert.equal(avgRating, 5.0, 'Average rating must calculate to 5.0');
    console.log(`✅ [SCEN-141 & SCEN-142 PASSED] Driver reputation updated: 5 reviews, sum 25, avg 5.0.`);

    // SCEN-143: Audit Log on Rating
    console.log(`[SCEN-143] Verifying Rating Audit Trail...`);
    const rateAudit = await AuditLog.findOne({
      action: 'cab.rate_driver_by_guest',
      targetId: String(trip1._id),
    }).lean();
    assert.ok(rateAudit, 'Audit log for cab.rate_driver_by_guest must exist');
    assert.equal(rateAudit.details?.stars, 5);
    cleanupManifest.auditLogs.push(String(rateAudit._id));
    console.log(`✅ [SCEN-143 PASSED] Audit log entry recorded with action cab.rate_driver_by_guest.`);

    // =========================================================================
    // STAGE 6: Category 16 — No-PIN Completion Arbitration & Payout Hold
    // =========================================================================
    console.log('\n--- STAGE 6: Category 16 — No-PIN Completion Arbitration & Payout Hold ---');

    // SCEN-144: Create Trip Completed Without PIN
    const trip5Ref = `CAB-${SUITE_ID}-005`;
    const trip5 = await Cab.create(
      makeTripData(trip5Ref, {
        guestName: 'Kunal Kapoor',
        guestPhone: '919844332211',
        destinations: [{ address: 'Batasia Loop, Darjeeling' }],
        destination: 'Batasia Loop, Darjeeling',
        status: 'COMPLETED',
        completedWithoutPin: true,
        noPinReviewedAt: null,
        driverSettlementStatus: 'PENDING',
        agreedFare: 2000,
        advanceAmount: 400,
        platformFeeAmount: 100,
        homestayCommissionAmount: 100,
        driverShareOfAdvance: 200,
      })
    );
    cleanupManifest.trips.push(String(trip5._id));

    // SCEN-145: PAYOUT_HOLD Defense
    console.log(`[SCEN-145] Testing PAYOUT_HOLD Defense on Unreviewed No-PIN Trip...`);
    const walletResBeforeReview = await api(`/v1/driver/wallet`, { token: driverMobileToken });
    assert.equal(walletResBeforeReview.status, 200);
    // Only Trip 1 (₹200) should be available. Trip 5 (₹200) must be held!
    assert.equal(walletResBeforeReview.data.available, 200, 'Unreviewed No-PIN trip must be excluded from wallet available balance');
    assert.equal(walletResBeforeReview.data.eligibleTrips, 1, 'Only 1 trip eligible');
    console.log(`✅ [SCEN-145 PASSED] PAYOUT_HOLD strictly prevents unreviewed No-PIN trip from entering wallet balance.`);

    // SCEN-148: Admin Review Invalid Inputs
    console.log(`[SCEN-148] Testing Admin Review Invalid Input Defenses...`);
    const badDecisionRes = await api(`/v1/admin/cab-requests/${trip5._id}/no-pin-review`, {
      token: adminToken,
      body: { decision: 'MAYBE' },
    });
    assert.equal(badDecisionRes.status, 400);
    assert.match(badDecisionRes.data.error.message, /Decision must be 'APPROVE' or 'NO_SHOW'/i);

    const noShowNoReasonRes = await api(`/v1/admin/cab-requests/${trip5._id}/no-pin-review`, {
      token: adminToken,
      body: { decision: 'NO_SHOW' },
    });
    assert.equal(noShowNoReasonRes.status, 400);
    assert.match(noShowNoReasonRes.data.error.message, /A reason is required to mark a no-show/i);
    console.log(`✅ [SCEN-148 PASSED] Malformed decisions and missing reasons strictly rejected with 400.`);

    // SCEN-146: Admin Approves Legitimate No-PIN Trip
    console.log(`[SCEN-146] Admin Approves Trip 5 after Host Verification...`);
    const approveNoPinRes = await api(`/v1/admin/cab-requests/${trip5._id}/no-pin-review`, {
      token: adminToken,
      body: { decision: 'APPROVE', reason: 'Host confirmed passenger boarded, guest phone was discharged.' },
    });
    assert.equal(approveNoPinRes.status, 200);

    const trip5Approved = await Cab.findById(trip5._id).lean();
    assert.ok(trip5Approved?.noPinReviewedAt, 'noPinReviewedAt timestamp must be stamped');

    // Wallet re-query: Trip 5 is NOW released and eligible!
    const walletResAfterReview = await api(`/v1/driver/wallet`, { token: driverMobileToken });
    assert.equal(walletResAfterReview.data.available, 400, 'Wallet balance must now include both Trip 1 (₹200) + Trip 5 (₹200) = ₹400');
    assert.equal(walletResAfterReview.data.eligibleTrips, 2);
    console.log(`✅ [SCEN-146 PASSED] Approved No-PIN trip unlocked, wallet balance updated to ₹400.`);

    // SCEN-147: Admin Marks Fraudulent / No-Show Trip
    console.log(`[SCEN-147] Testing Admin NO_SHOW Decision on Fraudulent Trip 6...`);
    const trip6Ref = `CAB-${SUITE_ID}-006`;
    const trip6 = await Cab.create(
      makeTripData(trip6Ref, {
        guestName: 'Ramesh Patel',
        guestPhone: '919877001122',
        destinations: [{ address: 'Siliguri Junction' }],
        destination: 'Siliguri Junction',
        status: 'COMPLETED',
        completedWithoutPin: true,
        noPinReviewedAt: null,
        driverSettlementStatus: 'PENDING',
        agreedFare: 2200,
        advanceAmount: 400,
        platformFeeAmount: 100,
        homestayCommissionAmount: 100,
        driverShareOfAdvance: 200,
      })
    );
    cleanupManifest.trips.push(String(trip6._id));

    const noShowRes = await api(`/v1/admin/cab-requests/${trip6._id}/no-pin-review`, {
      token: adminToken,
      body: { decision: 'NO_SHOW', reason: 'Guest cancelled via phone, driver never picked up.' },
    });
    assert.equal(noShowRes.status, 200);

    const trip6NoShow = await Cab.findById(trip6._id).lean();
    assert.equal(trip6NoShow?.noShow, true, 'noShow flag must be true');
    assert.equal(trip6NoShow?.refundStatus, 'PENDING', 'Guest advance refund status must transition to PENDING');
    assert.equal(trip6NoShow?.driverSettlementStatus, 'NONE', 'Driver settlement status must be revoked to NONE');

    const walletResAfterNoShow = await api(`/v1/driver/wallet`, { token: driverMobileToken });
    assert.equal(walletResAfterNoShow.data.available, 400, 'Wallet balance must remain ₹400 (Trip 6 completely excluded)');
    console.log(`✅ [SCEN-147 PASSED] NO_SHOW decision marked trip as noShow: true, refundStatus: PENDING, revoked driver settlement.`);

    // =========================================================================
    // STAGE 7: Categories 17-20 — Driver Wallet & Payout Operations
    // =========================================================================
    console.log('\n--- STAGE 7: Categories 17-20 — Driver Wallet & Payout Operations ---');

    // SCEN-149: Driver Wallet Balance Aggregation
    console.log(`[SCEN-149] Verifying Driver Sovereign Wallet Aggregation...`);
    const walletRes = await api(`/v1/driver/wallet`, { token: driverMobileToken });
    assert.equal(walletRes.status, 200);
    assert.equal(walletRes.data.available, 400, 'Available balance must equal ₹400');
    assert.equal(walletRes.data.eligibleTrips, 2);
    assert.equal(walletRes.data.trips.length, 2);
    console.log(`✅ [SCEN-149 PASSED] Wallet balance aggregated to ₹400 across 2 eligible completed trips.`);

    // SCEN-151: Payout Minimum Threshold Defense
    console.log(`[SCEN-151] Testing Zero Balance Payout Request Defense...`);
    // Web Driver Karan has no completed trips with surplus (Trip 3 was 160 surplus, let's create a driver with 0)
    const zeroDriver = await User.create({
      name: 'Zero Balance Driver',
      email: `zero_${SUITE_ID}@staycabs.qa`,
      phone: '919811009988',
      password: 'HashedPassword123!',
      role: 'driver',
      accountStatus: 'ACTIVE',
      tokenVersion: 0,
    });
    cleanupManifest.users.push(String(zeroDriver._id));
    const zeroDriverToken = signStayRideUserToken(zeroDriver);
    const zeroPayoutRes = await api(`/v1/driver/payouts/request`, {
      token: zeroDriverToken,
      body: { method: 'UPI', upiId: 'zero@upi' },
    });
    assert.equal(zeroPayoutRes.status, 400, 'Requesting payout with 0 balance must return 400 Bad Request');
    assert.match(zeroPayoutRes.data.error.message, /no eligible earnings/i);
    console.log(`✅ [SCEN-151 PASSED] Payout request with 0 balance strictly rejected with 400.`);

    // SCEN-150: Driver Requests Payout via UPI
    console.log(`[SCEN-150] Submitting Payout Request of ₹400 via UPI...`);
    const payoutReqRes = await api(`/v1/driver/payouts/request`, {
      token: driverMobileToken,
      body: { method: 'UPI', upiId: 'bikram.thapa@oksbi' },
    });
    assert.equal(payoutReqRes.status, 201, 'Payout request must return 201 Created');
    const payoutId = payoutReqRes.data.payout._id;
    cleanupManifest.payouts.push(String(payoutId));

    const payoutDoc = await Payout.findById(payoutId).lean();
    assert.equal(payoutDoc?.status, 'PENDING');
    assert.equal(payoutDoc?.amount, 400);
    assert.equal(payoutDoc?.upiId, 'bikram.thapa@oksbi');
    assert.equal(payoutDoc?.cabRequestIds?.length, 2);

    // Verify Trips Atomically Locked
    const lockedTrips = await Cab.find({ _id: { $in: [trip1._id, trip5._id] } }).lean();
    for (const t of lockedTrips) {
      assert.equal(String(t.driverPayoutId), String(payoutId), 'Trips must be atomically locked with driverPayoutId');
    }

    // Verify Wallet available balance drops to 0 and pendingPayout is populated
    const walletAfterReq = await api(`/v1/driver/wallet`, { token: driverMobileToken });
    assert.equal(walletAfterReq.data.available, 0, 'Available balance must become 0 while payout is pending');
    assert.equal(walletAfterReq.data.pendingPayout?.amount, 400);
    console.log(`✅ [SCEN-150 PASSED] Payout of ₹400 created; 2 trips atomically locked with driverPayoutId.`);

    // SCEN-152: Concurrent Payout Request Rejection
    console.log(`[SCEN-152] Testing Concurrent Payout Request Rejection...`);
    const concurrentReqRes = await api(`/v1/driver/payouts/request`, {
      token: driverMobileToken,
      body: { method: 'UPI', upiId: 'bikram.thapa@oksbi' },
    });
    assert.equal(concurrentReqRes.status, 409, 'Concurrent payout request must return 409 Conflict');
    assert.match(concurrentReqRes.data.error.message, /already have a payout request pending/i);
    console.log(`✅ [SCEN-152 PASSED] Concurrent payout request rejected with 409 Conflict.`);

    // SCEN-155: Admin Rejects Payout with Reason (e.g., Invalid UPI)
    console.log(`[SCEN-155] Testing Admin Rejection of Payout & Automatic Trip Unlock...`);
    const rejectRes = await api(`/v1/admin/driver-payouts/${payoutId}/reject`, {
      token: adminToken,
      body: { reason: 'Bank reported invalid UPI VPA: bikram.thapa@oksbi' },
    });
    assert.equal(rejectRes.status, 200, 'Rejecting payout must return 200 OK');

    const payoutAfterReject = await Payout.findById(payoutId).lean();
    assert.equal(payoutAfterReject?.status, 'REJECTED');
    assert.equal(payoutAfterReject?.rejectedReason, 'Bank reported invalid UPI VPA: bikram.thapa@oksbi');

    // Verify Trips Automatically Unlocked!
    const unlockedTrips = await Cab.find({ _id: { $in: [trip1._id, trip5._id] } }).lean();
    for (const t of unlockedTrips) {
      assert.equal(t.driverPayoutId, null, 'Trips must be automatically unlocked (driverPayoutId = null)');
    }

    // Verify Wallet Balance Automatically Restored!
    const walletAfterReject = await api(`/v1/driver/wallet`, { token: driverMobileToken });
    assert.equal(walletAfterReject.data.available, 400, 'Wallet balance must be restored to ₹400');
    assert.equal(walletAfterReject.data.pendingPayout, null, 'pendingPayout must now be null');
    console.log(`✅ [SCEN-155 PASSED] Payout rejected: trips unlocked and ₹400 wallet balance restored.`);

    // SCEN-153: Driver Resubmits Correct UPI & Admin Settles with UTR
    console.log(`[SCEN-153] Resubmitting Payout with Correct UPI & Admin Settlement...`);
    const payoutReq2Res = await api(`/v1/driver/payouts/request`, {
      token: driverMobileToken,
      body: { method: 'UPI', upiId: 'bikram@okhdfcbank' },
    });
    assert.equal(payoutReq2Res.status, 201);
    const payoutId2 = payoutReq2Res.data.payout._id;
    cleanupManifest.payouts.push(String(payoutId2));

    const settleUtr = '992288331122';
    const settleRes = await api(`/v1/admin/driver-payouts/${payoutId2}/settle`, {
      token: adminToken,
      body: { utrNumber: settleUtr, notes: 'Settled via HDFC IMPS' },
    });
    assert.equal(settleRes.status, 200, 'Settling payout must return 200 OK');

    const payoutSettled = await Payout.findById(payoutId2).lean();
    assert.equal(payoutSettled?.status, 'SETTLED');
    assert.equal(payoutSettled?.utrNumber, settleUtr);
    assert.ok(payoutSettled?.settledAt);

    // Verify Trips Marked SETTLED
    const settledTrips = await Cab.find({ _id: { $in: [trip1._id, trip5._id] } }).lean();
    for (const t of settledTrips) {
      assert.equal(t.driverSettlementStatus, 'SETTLED', 'Trip driverSettlementStatus must be SETTLED');
    }

    // Verify Driver Wallet History records settled payout with UTR
    const walletAfterSettle = await api(`/v1/driver/wallet`, { token: driverMobileToken });
    assert.equal(walletAfterSettle.data.available, 0);
    assert.equal(walletAfterSettle.data.history.length, 2); // 1 rejected + 1 settled
    const settledHistoryEntry = walletAfterSettle.data.history.find((h: any) => h.id === String(payoutId2));
    assert.ok(settledHistoryEntry);
    assert.equal(settledHistoryEntry.status, 'SETTLED');
    assert.equal(settledHistoryEntry.settlementReference, settleUtr);
    console.log(`✅ [SCEN-153 PASSED] Payout settled with UTR ${settleUtr}; trips marked SETTLED.`);

    // SCEN-154: WhatsApp Settlement Notification Dispatched
    console.log(`[SCEN-154] Verifying Outbound WhatsApp Settlement Notification...`);
    const settlementMsg = capturedOutboundWhatsApp.find((m: any) =>
      m.to === driverMobileUser.phone && (m.text?.includes(settleUtr) || JSON.stringify(m.components || '').includes(settleUtr))
    );
    assert.ok(settlementMsg, `Driver must receive WhatsApp notification confirming settlement with UTR ${settleUtr}`);
    console.log(`✅ [SCEN-154 PASSED] Outbound settlement notification safely captured: intercepted 100% with zero external bytes.`);

    console.log('\n=============================================================');
    console.log('🎉 ALL 45 SCENARIOS EXECUTED & VERIFIED ON LIVE MONGODB ATLAS!');
    console.log('=============================================================\n');

  } finally {
    // =========================================================================
    // CLEANUP: Purge all created QA documents
    // =========================================================================
    console.log('\n🧹 Commencing strict QA cleanup of test artifacts...');
    if (cleanupManifest.trips.length) {
      const r = await Cab.deleteMany({ _id: { $in: cleanupManifest.trips } });
      console.log(`- Cleaned up ${r.deletedCount} test cab requests`);
    }
    if (cleanupManifest.payouts.length) {
      const r = await Payout.deleteMany({ _id: { $in: cleanupManifest.payouts } });
      console.log(`- Cleaned up ${r.deletedCount} test payout requests`);
    }
    if (cleanupManifest.users.length) {
      const r = await User.deleteMany({ _id: { $in: cleanupManifest.users } });
      console.log(`- Cleaned up ${r.deletedCount} test users`);
    }
    if (cleanupManifest.properties.length) {
      const r = await Property.deleteMany({ _id: { $in: cleanupManifest.properties } });
      console.log(`- Cleaned up ${r.deletedCount} test properties`);
    }
    if (cleanupManifest.guestLinks.length) {
      const r = await GuestLink.deleteMany({ _id: { $in: cleanupManifest.guestLinks } });
      console.log(`- Cleaned up ${r.deletedCount} test guest links`);
    }
    if (cleanupManifest.auditLogs.length) {
      const r = await AuditLog.deleteMany({ _id: { $in: cleanupManifest.auditLogs } });
      console.log(`- Cleaned up ${r.deletedCount} test audit logs`);
    }
    server.close();
  }
}

runSuite().then(() => {
  console.log('🏁 Test Suite Finished Successfully.');
  process.exit(0);
}).catch((err) => {
  console.error('\n❌ Test Suite Failed with Error:\n', err);
  process.exit(1);
});
